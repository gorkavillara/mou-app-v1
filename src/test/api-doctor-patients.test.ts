import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Tests for B-06..B-10. We mock @/lib/supabase/server to return a stub
 * supabase client that records the table/method calls and yields canned
 * responses set per-test.
 *
 * The stub supports the chainable subset we actually use:
 *   .from(table).select(cols).eq(col, val).maybeSingle()
 *   .from(table).insert(row).select(cols).single()
 *   .from(table).update(row).eq(col, val).select(cols).single()
 *   .from(table).select(cols).is/not/ilike/lte/order/limit ... [thenable]
 *
 * Each test sets a `tableHandlers` map describing what each chain returns.
 */

type QueryResult = { data: unknown; error: unknown };

type Handler = (op: {
  table: string;
  op: string;
  args: unknown[];
  filters: Array<{ kind: string; args: unknown[] }>;
  selectArgs?: unknown[];
}) => QueryResult;

let handlers: Record<string, Handler[]> = {};
let authUser: { id: string } | null = null;

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
  const chainMethods = ['eq', 'is', 'not', 'ilike', 'lte', 'order', 'limit'];
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
  // Make the builder thenable (so awaiting the chain itself works).
  builder.then = (resolve: (v: QueryResult) => void) => resolve(result());
  return builder;
}

function makeStubSupabase() {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: authUser },
      })),
    },
    from: (table: string) => ({
      select: (...args: unknown[]) => makeQueryBuilder(table, 'select', args),
      insert: (...args: unknown[]) => makeQueryBuilder(table, 'insert', args),
      update: (...args: unknown[]) => makeQueryBuilder(table, 'update', args),
      delete: (...args: unknown[]) => makeQueryBuilder(table, 'delete', args),
    }),
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => makeStubSupabase()),
}));

// Mock qrcode so tests don't actually generate PNGs.
vi.mock('qrcode', () => ({
  default: {
    toBuffer: vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  },
}));

// Import routes AFTER the mock is registered.
import { POST as createPatient, GET as listPatients } from '@/app/api/doctor/patients/route';
import { POST as createPrescription } from '@/app/api/doctor/patients/[id]/prescriptions/route';
import { POST as dischargePatient } from '@/app/api/doctor/patients/[id]/discharge/route';
import { GET as getPatientQr } from '@/app/api/doctor/patients/[id]/qr.png/route';

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  handlers = {};
  authUser = { id: '00000000-0000-0000-0000-000000000001' };
});

describe('POST /api/doctor/patients (B-06)', () => {
  it('201 happy path', async () => {
    handlers['patients:insert'] = [
      () => ({
        data: {
          id: 'p1',
          doctor_id: authUser!.id,
          external_id: 'HC-001',
          pathology_code: 'flexor',
          access_token: 'tok-abc',
          started_at: '2026-05-09',
          discharged_at: null,
          created_at: '2026-05-09T10:00:00Z',
          updated_at: '2026-05-09T10:00:00Z',
        },
        error: null,
      }),
    ];

    const req = jsonRequest('http://localhost:3500/api/doctor/patients', 'POST', {
      external_id: 'HC-001',
      pathology_code: 'flexor',
    });
    const res = await createPatient(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.patient.external_id).toBe('HC-001');
    expect(body.public_url).toBe('http://localhost:3500/p/tok-abc');
  });

  it('400 when PII fields are included (strict schema)', async () => {
    const req = jsonRequest('http://localhost:3500/api/doctor/patients', 'POST', {
      external_id: 'HC-001',
      name: 'Juan Perez', // PII — must be rejected
    });
    const res = await createPatient(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('400 when external_id missing', async () => {
    const req = jsonRequest('http://localhost:3500/api/doctor/patients', 'POST', {});
    const res = await createPatient(req);
    expect(res.status).toBe(400);
  });

  it('409 on duplicate external_id (Postgres 23505)', async () => {
    handlers['patients:insert'] = [
      () => ({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      }),
    ];
    const req = jsonRequest('http://localhost:3500/api/doctor/patients', 'POST', {
      external_id: 'HC-001',
    });
    const res = await createPatient(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('duplicate_external_id');
  });
});

describe('GET /api/doctor/patients (B-07)', () => {
  it('returns array and respects search', async () => {
    handlers['patients:select'] = [
      ({ filters }) => {
        // Verify ilike filter is applied when search is present.
        const ilike = filters.find((f) => f.kind === 'ilike');
        expect(ilike).toBeDefined();
        expect(ilike!.args[0]).toBe('external_id');
        return {
          data: [
            {
              id: 'p1',
              external_id: 'HC-001',
              pathology_code: 'flexor',
              started_at: '2026-05-09',
              discharged_at: null,
            },
          ],
          error: null,
        };
      },
    ];
    handlers['patient_adherence_breakdown:select'] = [
      () => ({
        data: [
          {
            patient_id: 'p1',
            total_completed: 3,
            total_target: 10,
            total_pct: 30,
            week_completed: 2,
            week_target: 4,
            week_pct: 50,
          },
        ],
        error: null,
      }),
    ];

    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients?search=HC',
      'GET',
    );
    const res = await listPatients(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.patients)).toBe(true);
    expect(body.patients[0].adherence_pct).toBe(30);
    expect(body.patients[0].completed_sessions).toBe(3);
    expect(body.patients[0].adherence.total.pct).toBe(30);
    expect(body.patients[0].adherence.week.pct).toBe(50);
    expect(body.patients[0].adherence.week.completed).toBe(2);
  });

  it('returns array without search', async () => {
    handlers['patients:select'] = [() => ({ data: [], error: null })];
    handlers['patient_adherence_breakdown:select'] = [() => ({ data: [], error: null })];

    const req = jsonRequest('http://localhost:3500/api/doctor/patients', 'GET');
    const res = await listPatients(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.patients).toEqual([]);
  });
});

describe('POST /api/doctor/patients/:id/prescriptions (B-09)', () => {
  // A proper UUID v4 string (Zod 4's z.uuid() requires version 1-8 in the
  // 13th nibble; 'a' is valid, '0' is not).
  const VALID_UUID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

  it('400 when exercise_id does not exist', async () => {
    handlers['patients:select'] = [
      () => ({ data: { id: 'p1' }, error: null }),
    ];
    handlers['exercises:select'] = [() => ({ data: null, error: null })];

    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1/prescriptions',
      'POST',
      {
        exercise_id: VALID_UUID,
        sets: 3,
        reps_per_set: 20,
        sessions_per_day: 4,
        duration_days: 14,
      },
    );
    const res = await createPrescription(req, {
      params: Promise.resolve({ id: 'p1' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_exercise');
  });

  it('404 when patient not visible', async () => {
    handlers['patients:select'] = [() => ({ data: null, error: null })];
    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1/prescriptions',
      'POST',
      {
        exercise_id: VALID_UUID,
        sets: 3,
        reps_per_set: 20,
        sessions_per_day: 4,
        duration_days: 14,
      },
    );
    const res = await createPrescription(req, {
      params: Promise.resolve({ id: 'p1' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/doctor/patients/:id/discharge (B-10)', () => {
  it('idempotent on already-discharged patient (200 + flag)', async () => {
    handlers['patients:select'] = [
      () => ({
        data: {
          id: 'p1',
          external_id: 'HC-001',
          started_at: '2026-05-01',
          discharged_at: '2026-05-08',
        },
        error: null,
      }),
    ];

    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1/discharge',
      'POST',
    );
    const res = await dischargePatient(req, {
      params: Promise.resolve({ id: 'p1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.already_discharged).toBe(true);
    expect(body.patient.discharged_at).toBe('2026-05-08');
  });

  it('discharges an active patient', async () => {
    handlers['patients:select'] = [
      () => ({
        data: {
          id: 'p1',
          external_id: 'HC-001',
          started_at: '2026-05-01',
          discharged_at: null,
        },
        error: null,
      }),
    ];
    handlers['patients:update'] = [
      () => ({
        data: {
          id: 'p1',
          external_id: 'HC-001',
          started_at: '2026-05-01',
          discharged_at: '2026-05-09',
        },
        error: null,
      }),
    ];

    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1/discharge',
      'POST',
    );
    const res = await dischargePatient(req, {
      params: Promise.resolve({ id: 'p1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.already_discharged).toBe(false);
    expect(body.patient.discharged_at).toBe('2026-05-09');
  });

  it('404 when patient not visible', async () => {
    handlers['patients:select'] = [() => ({ data: null, error: null })];
    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1/discharge',
      'POST',
    );
    const res = await dischargePatient(req, {
      params: Promise.resolve({ id: 'p1' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/doctor/patients/:id/qr.png (B-15)', () => {
  it('200 returns image/png', async () => {
    handlers['patients:select'] = [
      () => ({
        data: { access_token: 'tok-abc-1234567890abcdef' },
        error: null,
      }),
    ];

    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1/qr.png',
      'GET',
    );
    const res = await getPatientQr(req, {
      params: Promise.resolve({ id: 'p1' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toContain('private');

    const buf = new Uint8Array(await res.arrayBuffer());
    // Our mocked toBuffer returns the PNG signature head (0x89 0x50 0x4e 0x47).
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
  });

  it('404 when patient not visible', async () => {
    handlers['patients:select'] = [() => ({ data: null, error: null })];

    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1/qr.png',
      'GET',
    );
    const res = await getPatientQr(req, {
      params: Promise.resolve({ id: 'p1' }),
    });
    expect(res.status).toBe(404);
  });
});
