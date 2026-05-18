import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Tests for B-11 (GET /api/patient/[token]) and B-12 (POST sessions).
 *
 * We mock @/lib/supabase/admin (the service-role client) with the same
 * chainable stub pattern used in api-doctor-patients.test.ts.
 *
 * The stub supports:
 *   .from(t).select(c).eq(...).maybeSingle()
 *   .from(t).select(c, { count, head }).eq(...).gte(...)  // returns { count, error }
 *   .from(t).select(c).eq(...).lte(...)                   // thenable list
 *   .from(t).insert(rows).select(...).single()
 *   .from(t).insert(rows)                                 // thenable
 *   .from(t).delete().eq(...)                             // thenable
 */

type QueryResult = { data: unknown; error: unknown; count?: number };

type Handler = (op: {
  table: string;
  op: string;
  args: unknown[];
  filters: Array<{ kind: string; args: unknown[] }>;
  selectArgs?: unknown[];
}) => QueryResult;

let handlers: Record<string, Handler[]> = {};

function makeQueryBuilder(table: string, op: string, args: unknown[]) {
  const filters: Array<{ kind: string; args: unknown[] }> = [];
  let selectArgs: unknown[] | undefined;

  const result = (): QueryResult => {
    const queue = handlers[`${table}:${op}`] ?? handlers[`${table}:*`];
    if (!queue || queue.length === 0) {
      return { data: null, error: { message: `no handler for ${table}:${op}` } };
    }
    const handler = queue.shift()!;
    return handler({ table, op, args, filters, selectArgs });
  };

  const builder: Record<string, unknown> = {};
  const chainMethods = ['eq', 'is', 'not', 'ilike', 'lte', 'gte', 'order', 'limit'];
  for (const m of chainMethods) {
    builder[m] = (...a: unknown[]) => {
      filters.push({ kind: m, args: a });
      return builder;
    };
  }
  builder.select = (...a: unknown[]) => {
    selectArgs = a;
    return builder;
  };
  builder.maybeSingle = async () => result();
  builder.single = async () => result();
  builder.then = (resolve: (v: QueryResult) => void) => resolve(result());
  return builder;
}

function makeAdminStub() {
  return {
    from: (table: string) => ({
      select: (...args: unknown[]) => makeQueryBuilder(table, 'select', args),
      insert: (...args: unknown[]) => makeQueryBuilder(table, 'insert', args),
      update: (...args: unknown[]) => makeQueryBuilder(table, 'update', args),
      delete: (...args: unknown[]) => makeQueryBuilder(table, 'delete', args),
    }),
  };
}

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: vi.fn(() => makeAdminStub()),
}));

import { GET as getPatient } from '@/app/api/patient/[token]/route';
import { POST as createSession } from '@/app/api/patient/[token]/sessions/route';

const VALID_TOKEN = 'a'.repeat(32);
const VALID_UUID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const OTHER_UUID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

beforeEach(() => {
  handlers = {};
});

describe('GET /api/patient/[token] (B-11)', () => {
  it('200 happy path with active prescription', async () => {
    handlers['patients:select'] = [
      () => ({
        data: {
          id: 'p1',
          external_id: 'HC-001',
          pathology_code: 'flexor',
          started_at: '2026-05-01',
          discharged_at: null,
        },
        error: null,
      }),
    ];
    handlers['prescriptions:select'] = [
      () => ({
        data: [
          {
            id: 'rx1',
            exercise_id: 'ex1',
            sets: 3,
            reps_per_set: 20,
            sessions_per_day: 4,
            duration_days: 14,
            starts_on: isoPlusDays(-2), // started 2 days ago
            exercise: {
              id: 'ex1',
              code: 'flexion-pasiva-dedos',
              name: 'Flexión pasiva',
              description: null,
              animation_url: null,
              tracked_joints: ['MCP', 'PIP', 'DIP'],
              target_finger: 'all',
            },
          },
        ],
        error: null,
      }),
    ];
    handlers['sessions:select'] = [
      () => ({ data: null, error: null, count: 1 }),
    ];

    const req = jsonRequest(
      `http://localhost:3500/api/patient/${VALID_TOKEN}`,
      'GET',
    );
    const res = await getPatient(req, {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.patient.id).toBe('p1');
    expect(body.prescriptions).toHaveLength(1);
    expect(body.prescriptions[0].exercise.code).toBe('flexion-pasiva-dedos');
    expect(body.today.sessions_target).toBe(4);
    expect(body.today.sessions_completed).toBe(1);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('404 on bad/short token', async () => {
    const shortToken = 'abc';
    const req = jsonRequest(
      `http://localhost:3500/api/patient/${shortToken}`,
      'GET',
    );
    const res = await getPatient(req, {
      params: Promise.resolve({ token: shortToken }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });

  it('404 when token does not match any patient', async () => {
    handlers['patients:select'] = [() => ({ data: null, error: null })];

    const req = jsonRequest(
      `http://localhost:3500/api/patient/${VALID_TOKEN}`,
      'GET',
    );
    const res = await getPatient(req, {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(404);
  });

  it('410 when patient is discharged', async () => {
    handlers['patients:select'] = [
      () => ({
        data: {
          id: 'p1',
          external_id: 'HC-001',
          pathology_code: 'flexor',
          started_at: '2026-04-01',
          discharged_at: '2026-05-01',
        },
        error: null,
      }),
    ];

    const req = jsonRequest(
      `http://localhost:3500/api/patient/${VALID_TOKEN}`,
      'GET',
    );
    const res = await getPatient(req, {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe('tratamiento_finalizado');
  });

  it('open-ended prescription (duration_days = null) is returned as active forever as long as the patient is not discharged', async () => {
    // Bugfix manual-testing 2026-05-11: a prescription with NULL
    // duration_days must NOT be filtered out, regardless of how long ago
    // starts_on is. Treatment ends only when the doctor discharges.
    handlers['patients:select'] = [
      () => ({
        data: {
          id: 'p1',
          external_id: 'HC-001',
          pathology_code: 'flexor',
          started_at: '2026-01-01',
          discharged_at: null,
        },
        error: null,
      }),
    ];
    handlers['prescriptions:select'] = [
      () => ({
        data: [
          {
            id: 'rx-open',
            exercise_id: 'ex1',
            sets: 3,
            reps_per_set: 20,
            sessions_per_day: 4,
            duration_days: null, // open-ended
            starts_on: '2026-01-01', // way in the past — should still be active
            exercise: {
              id: 'ex1',
              code: 'flexion-pasiva-dedos',
              name: 'Flexión pasiva',
              description: null,
              animation_url: null,
              tracked_joints: ['MCP'],
              target_finger: 'all',
            },
          },
        ],
        error: null,
      }),
    ];
    handlers['sessions:select'] = [
      () => ({ data: null, error: null, count: 0 }),
    ];

    const req = jsonRequest(
      `http://localhost:3500/api/patient/${VALID_TOKEN}`,
      'GET',
    );
    const res = await getPatient(req, {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.prescriptions).toHaveLength(1);
    expect(body.prescriptions[0].duration_days).toBeNull();
    // Open-ended prescriptions have no closing date.
    expect(body.prescriptions[0].ends_on).toBeNull();
  });

  it('410 when all prescriptions have expired', async () => {
    handlers['patients:select'] = [
      () => ({
        data: {
          id: 'p1',
          external_id: 'HC-001',
          pathology_code: 'flexor',
          started_at: '2026-01-01',
          discharged_at: null,
        },
        error: null,
      }),
    ];
    handlers['prescriptions:select'] = [
      () => ({
        data: [
          {
            id: 'rx1',
            exercise_id: 'ex1',
            sets: 3,
            reps_per_set: 20,
            sessions_per_day: 4,
            duration_days: 14,
            starts_on: '2026-01-01', // long expired
            exercise: {
              id: 'ex1',
              code: 'flexion-pasiva-dedos',
              name: 'Flexión',
              description: null,
              animation_url: null,
              tracked_joints: ['MCP'],
              target_finger: 'all',
            },
          },
        ],
        error: null,
      }),
    ];

    const req = jsonRequest(
      `http://localhost:3500/api/patient/${VALID_TOKEN}`,
      'GET',
    );
    const res = await getPatient(req, {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(410);
  });
});

describe('POST /api/patient/[token]/sessions (B-12)', () => {
  const validBody = {
    prescription_id: VALID_UUID,
    started_at: '2026-05-09T10:00:00.000Z',
    ended_at: '2026-05-09T10:05:00.000Z',
    reps_completed: 18,
    target_reps: 20,
    rep_measurements: [
      {
        rep_index: 0,
        joint: 'MCP-index',
        max_flexion_deg: 80,
        max_extension_deg: 5,
        quality_flag: 'clean',
      },
    ],
  };

  it('201 happy path', async () => {
    handlers['patients:select'] = [
      () => ({
        data: { id: 'p1', discharged_at: null },
        error: null,
      }),
    ];
    handlers['prescriptions:select'] = [
      () => ({
        data: { id: VALID_UUID, patient_id: 'p1' },
        error: null,
      }),
    ];
    handlers['sessions:insert'] = [
      () => ({
        data: { id: 's1', completion_pct: 90 },
        error: null,
      }),
    ];
    handlers['rep_measurements:insert'] = [
      () => ({ data: null, error: null }),
    ];

    const req = jsonRequest(
      `http://localhost:3500/api/patient/${VALID_TOKEN}/sessions`,
      'POST',
      validBody,
    );
    const res = await createSession(req, {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.session.id).toBe('s1');
    expect(body.session.completion_pct).toBe(90);
  });

  it('400 on invalid body (missing fields)', async () => {
    const req = jsonRequest(
      `http://localhost:3500/api/patient/${VALID_TOKEN}/sessions`,
      'POST',
      { prescription_id: VALID_UUID },
    );
    const res = await createSession(req, {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('400 on extra (PII) fields — strict schema', async () => {
    const req = jsonRequest(
      `http://localhost:3500/api/patient/${VALID_TOKEN}/sessions`,
      'POST',
      { ...validBody, name: 'Juan' },
    );
    const res = await createSession(req, {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(400);
  });

  it('410 when patient is discharged', async () => {
    handlers['patients:select'] = [
      () => ({
        data: { id: 'p1', discharged_at: '2026-05-01' },
        error: null,
      }),
    ];

    const req = jsonRequest(
      `http://localhost:3500/api/patient/${VALID_TOKEN}/sessions`,
      'POST',
      validBody,
    );
    const res = await createSession(req, {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(410);
  });

  it('400 when prescription_id belongs to another patient', async () => {
    handlers['patients:select'] = [
      () => ({
        data: { id: 'p1', discharged_at: null },
        error: null,
      }),
    ];
    handlers['prescriptions:select'] = [
      () => ({
        data: { id: VALID_UUID, patient_id: 'p_other' },
        error: null,
      }),
    ];

    const req = jsonRequest(
      `http://localhost:3500/api/patient/${VALID_TOKEN}/sessions`,
      'POST',
      validBody,
    );
    const res = await createSession(req, {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_prescription');
  });

  it('404 when token unknown', async () => {
    handlers['patients:select'] = [() => ({ data: null, error: null })];

    const req = jsonRequest(
      `http://localhost:3500/api/patient/${VALID_TOKEN}/sessions`,
      'POST',
      validBody,
    );
    const res = await createSession(req, {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });
    expect(res.status).toBe(404);
  });

  // Reference OTHER_UUID to silence unused-var lint.
  it('rejects malformed token (404)', async () => {
    expect(OTHER_UUID).toBeDefined();
    const req = jsonRequest(
      'http://localhost:3500/api/patient/short/sessions',
      'POST',
      validBody,
    );
    const res = await createSession(req, {
      params: Promise.resolve({ token: 'short' }),
    });
    expect(res.status).toBe(404);
  });

  it('isoToday helper sanity', () => {
    expect(isoToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
