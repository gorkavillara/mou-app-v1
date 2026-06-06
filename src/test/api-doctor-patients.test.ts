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
import { PATCH as patchPatient } from '@/app/api/doctor/patients/[id]/route';
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

  it('201 persists injured_fingers + amputated_fingers arrays (FB-1)', async () => {
    handlers['patients:insert'] = [
      ({ args }) => {
        const row = (args[0] ?? {}) as {
          injured_fingers?: string[];
          amputated_fingers?: string[];
        };
        expect(row.injured_fingers).toEqual(['menique', 'anular']);
        expect(row.amputated_fingers).toEqual(['pulgar']);
        return {
          data: {
            id: 'p1',
            doctor_id: authUser!.id,
            external_id: 'HC-002',
            pathology_code: 'flexor',
            injured_fingers: ['menique', 'anular'],
            amputated_fingers: ['pulgar'],
            access_token: 'tok-xyz',
            started_at: '2026-05-20',
            discharged_at: null,
            created_at: '2026-05-20T10:00:00Z',
            updated_at: '2026-05-20T10:00:00Z',
          },
          error: null,
        };
      },
    ];

    const req = jsonRequest('http://localhost:3500/api/doctor/patients', 'POST', {
      external_id: 'HC-002',
      pathology_code: 'flexor',
      injured_fingers: ['menique', 'anular'],
      amputated_fingers: ['pulgar'],
    });
    const res = await createPatient(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.patient.injured_fingers).toEqual(['menique', 'anular']);
    expect(body.patient.amputated_fingers).toEqual(['pulgar']);
  });

  it('201 defaults missing finger arrays to [] (FB-1)', async () => {
    handlers['patients:insert'] = [
      ({ args }) => {
        const row = (args[0] ?? {}) as {
          injured_fingers?: string[];
          amputated_fingers?: string[];
        };
        expect(row.injured_fingers).toEqual([]);
        expect(row.amputated_fingers).toEqual([]);
        return {
          data: {
            id: 'p1',
            doctor_id: authUser!.id,
            external_id: 'HC-002b',
            pathology_code: null,
            injured_fingers: [],
            amputated_fingers: [],
            access_token: 'tok-empty',
            started_at: '2026-05-20',
            discharged_at: null,
            created_at: '2026-05-20T10:00:00Z',
            updated_at: '2026-05-20T10:00:00Z',
          },
          error: null,
        };
      },
    ];
    const req = jsonRequest('http://localhost:3500/api/doctor/patients', 'POST', {
      external_id: 'HC-002b',
    });
    const res = await createPatient(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.patient.injured_fingers).toEqual([]);
    expect(body.patient.amputated_fingers).toEqual([]);
  });

  it('400 when a finger value is invalid (FB-1)', async () => {
    const req = jsonRequest('http://localhost:3500/api/doctor/patients', 'POST', {
      external_id: 'HC-003',
      injured_fingers: ['pinky'], // English — not a valid FingerName
    });
    const res = await createPatient(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('400 when injured/amputated arrays overlap in one request (FB-1)', async () => {
    const req = jsonRequest('http://localhost:3500/api/doctor/patients', 'POST', {
      external_id: 'HC-003b',
      injured_fingers: ['menique', 'anular'],
      amputated_fingers: ['anular'], // overlaps with injured
    });
    const res = await createPatient(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('400 when legacy injured_finger (singular) is sent (FB-1 strict)', async () => {
    const req = jsonRequest('http://localhost:3500/api/doctor/patients', 'POST', {
      external_id: 'HC-003c',
      injured_finger: 'menique', // removed field — strict schema rejects it
    });
    const res = await createPatient(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('201 accepts external_id with single spaces — "PRUEBA 1" (UX-6)', async () => {
    handlers['patients:insert'] = [
      ({ args }) => {
        const row = (args[0] ?? {}) as { external_id?: string };
        expect(row.external_id).toBe('PRUEBA 1');
        return {
          data: {
            id: 'p2',
            doctor_id: authUser!.id,
            external_id: 'PRUEBA 1',
            pathology_code: null,
            injured_finger: null,
            access_token: 'tok-prueba',
            started_at: '2026-05-20',
            discharged_at: null,
            created_at: '2026-05-20T10:00:00Z',
            updated_at: '2026-05-20T10:00:00Z',
          },
          error: null,
        };
      },
    ];
    const req = jsonRequest('http://localhost:3500/api/doctor/patients', 'POST', {
      external_id: 'PRUEBA 1',
    });
    const res = await createPatient(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.patient.external_id).toBe('PRUEBA 1');
  });

  it('400 on leading/trailing space in external_id (UX-6)', async () => {
    for (const bad of ['  X', 'X ', 'A  B']) {
      const req = jsonRequest('http://localhost:3500/api/doctor/patients', 'POST', {
        external_id: bad,
      });
      const res = await createPatient(req);
      expect(res.status).toBe(400);
    }
  });

  it('201 persists surgery_date + surgery_note (UX-5)', async () => {
    handlers['patients:insert'] = [
      ({ args }) => {
        const row = (args[0] ?? {}) as {
          surgery_date?: string | null;
          surgery_note?: string | null;
        };
        expect(row.surgery_date).toBe('2026-05-19');
        expect(row.surgery_note).toBe('Tenorrafia FDP 5º dedo');
        return {
          data: {
            id: 'p1',
            doctor_id: authUser!.id,
            external_id: 'HC-005',
            pathology_code: 'flexor',
            injured_finger: 'menique',
            surgery_date: '2026-05-19',
            surgery_note: 'Tenorrafia FDP 5º dedo',
            access_token: 'tok-iq',
            started_at: '2026-05-20',
            discharged_at: null,
            created_at: '2026-05-20T10:00:00Z',
            updated_at: '2026-05-20T10:00:00Z',
          },
          error: null,
        };
      },
    ];
    const req = jsonRequest('http://localhost:3500/api/doctor/patients', 'POST', {
      external_id: 'HC-005',
      pathology_code: 'flexor',
      injured_fingers: ['menique'],
      surgery_date: '2026-05-19',
      surgery_note: 'Tenorrafia FDP 5º dedo',
    });
    const res = await createPatient(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.patient.surgery_date).toBe('2026-05-19');
    expect(body.patient.surgery_note).toBe('Tenorrafia FDP 5º dedo');
  });

  it('400 on invalid calendar surgery_date (UX-5)', async () => {
    const req = jsonRequest('http://localhost:3500/api/doctor/patients', 'POST', {
      external_id: 'HC-006',
      surgery_date: '2026-13-40',
    });
    const res = await createPatient(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('400 when surgery_note exceeds 120 chars (UX-5)', async () => {
    const req = jsonRequest('http://localhost:3500/api/doctor/patients', 'POST', {
      external_id: 'HC-007',
      surgery_note: 'x'.repeat(121),
    });
    const res = await createPatient(req);
    expect(res.status).toBe(400);
  });

  it('400 on empty-string surgery_note (UX-5)', async () => {
    const req = jsonRequest('http://localhost:3500/api/doctor/patients', 'POST', {
      external_id: 'HC-008',
      surgery_note: '   ', // trims to empty → rejected
    });
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

  it('201 when duration_days is omitted from the body (open-ended treatment)', async () => {
    // Bugfix manual-testing 2026-05-11: doctor can prescribe without
    // duration; treatment ends only on /discharge. The insert must persist
    // duration_days as NULL.
    handlers['patients:select'] = [() => ({ data: { id: 'p1' }, error: null })];
    handlers['exercises:select'] = [() => ({ data: { id: VALID_UUID }, error: null })];
    handlers['prescriptions:insert'] = [
      ({ args }) => {
        // The first arg to .insert is the row payload.
        const row = (args[0] ?? {}) as { duration_days?: number | null };
        expect(row.duration_days).toBeNull();
        return {
          data: {
            id: 'rx1',
            patient_id: 'p1',
            exercise_id: VALID_UUID,
            sets: 3,
            reps_per_set: 20,
            sessions_per_day: 4,
            duration_days: null,
            starts_on: '2026-05-11',
            replaces_id: null,
            created_at: '2026-05-11T10:00:00Z',
          },
          error: null,
        };
      },
    ];

    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1/prescriptions',
      'POST',
      {
        exercise_id: VALID_UUID,
        sets: 3,
        reps_per_set: 20,
        sessions_per_day: 4,
        // duration_days intentionally omitted
      },
    );
    const res = await createPrescription(req, {
      params: Promise.resolve({ id: 'p1' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.prescription.duration_days).toBeNull();
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

describe('PATCH /api/doctor/patients/:id (FB-1)', () => {
  it('replaces injured_fingers + amputated_fingers (200 + updated patient)', async () => {
    handlers['patients:update'] = [
      ({ args }) => {
        const row = (args[0] ?? {}) as {
          injured_fingers?: string[];
          amputated_fingers?: string[];
        };
        expect(row.injured_fingers).toEqual(['anular', 'medio']);
        expect(row.amputated_fingers).toEqual(['pulgar']);
        return {
          data: {
            id: 'p1',
            external_id: 'HC-001',
            pathology_code: 'flexor',
            injured_fingers: ['anular', 'medio'],
            amputated_fingers: ['pulgar'],
            access_token: 'tok-abc',
            started_at: '2026-05-01',
            discharged_at: null,
            created_at: '2026-05-01T10:00:00Z',
            updated_at: '2026-05-20T10:00:00Z',
          },
          error: null,
        };
      },
    ];
    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1',
      'PATCH',
      { injured_fingers: ['anular', 'medio'], amputated_fingers: ['pulgar'] },
    );
    const res = await patchPatient(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.patient.injured_fingers).toEqual(['anular', 'medio']);
    expect(body.patient.amputated_fingers).toEqual(['pulgar']);
  });

  it('clears injured_fingers with [] (200)', async () => {
    handlers['patients:update'] = [
      ({ args }) => {
        const row = (args[0] ?? {}) as { injured_fingers?: string[] };
        expect(row.injured_fingers).toEqual([]);
        return {
          data: {
            id: 'p1',
            external_id: 'HC-001',
            pathology_code: 'flexor',
            injured_fingers: [],
            amputated_fingers: ['pulgar'],
            access_token: 'tok-abc',
            started_at: '2026-05-01',
            discharged_at: null,
            created_at: '2026-05-01T10:00:00Z',
            updated_at: '2026-05-20T10:00:00Z',
          },
          error: null,
        };
      },
    ];
    // Single-array PATCH triggers read-modify-validate: stub the current DB row.
    handlers['patients:select'] = [
      () => ({
        data: { injured_fingers: ['anular'], amputated_fingers: ['pulgar'] },
        error: null,
      }),
    ];
    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1',
      'PATCH',
      { injured_fingers: [] },
    );
    const res = await patchPatient(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.patient.injured_fingers).toEqual([]);
  });

  it('400 fingers_overlap when single-array PATCH overlaps the OTHER array in DB (FB-1)', async () => {
    // Body sends only injured_fingers=['anular']; the DB already has
    // amputated_fingers=['anular'] → read-modify-validate must reject before
    // writing. The update handler must NOT run.
    handlers['patients:select'] = [
      () => ({
        data: { injured_fingers: [], amputated_fingers: ['anular'] },
        error: null,
      }),
    ];
    handlers['patients:update'] = [
      () => {
        throw new Error('update must not run when overlap is detected');
      },
    ];
    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1',
      'PATCH',
      { injured_fingers: ['anular'] },
    );
    const res = await patchPatient(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('fingers_overlap');
  });

  it('400 fingers_overlap when both arrays overlap in one request (FB-1)', async () => {
    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1',
      'PATCH',
      { injured_fingers: ['anular'], amputated_fingers: ['anular'] },
    );
    const res = await patchPatient(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    // Schema-level refine → invalid_body (both arrays present in one request).
    expect(body.error).toBe('invalid_body');
  });

  it('400 fingers_overlap mapped from DB 23514 backstop (FB-1)', async () => {
    handlers['patients:select'] = [
      () => ({
        data: { injured_fingers: [], amputated_fingers: [] },
        error: null,
      }),
    ];
    handlers['patients:update'] = [
      () => ({
        data: null,
        error: {
          code: '23514',
          message: 'new row violates check constraint "fingers_no_overlap"',
        },
      }),
    ];
    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1',
      'PATCH',
      { injured_fingers: ['anular'] },
    );
    const res = await patchPatient(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('fingers_overlap');
  });

  it('404 when patient not visible', async () => {
    // surgery_note-only PATCH skips read-modify-validate, so the update runs
    // directly and returns no row → 404.
    handlers['patients:update'] = [() => ({ data: null, error: null })];
    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1',
      'PATCH',
      { surgery_note: 'Tenorrafia' },
    );
    const res = await patchPatient(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(404);
  });

  it('400 on extra fields (strict schema)', async () => {
    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1',
      'PATCH',
      { injured_fingers: ['pulgar'], name: 'Juan' },
    );
    const res = await patchPatient(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('400 on legacy injured_finger (singular) key — strict (FB-1)', async () => {
    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1',
      'PATCH',
      { injured_finger: 'pulgar' },
    );
    const res = await patchPatient(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('400 on invalid finger value', async () => {
    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1',
      'PATCH',
      { injured_fingers: ['thumb'] },
    );
    const res = await patchPatient(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(400);
  });

  it('sets surgery_date + surgery_note (UX-5, 200)', async () => {
    handlers['patients:update'] = [
      ({ args }) => {
        const row = (args[0] ?? {}) as Record<string, unknown>;
        expect(row.surgery_date).toBe('2026-05-19');
        expect(row.surgery_note).toBe('Tenorrafia FDP 5º dedo');
        // Only the keys present in the body are written — injured_finger
        // must NOT be clobbered when it wasn't sent.
        expect('injured_finger' in row).toBe(false);
        return {
          data: {
            id: 'p1',
            external_id: 'HC-001',
            pathology_code: 'flexor',
            injured_finger: 'menique',
            surgery_date: '2026-05-19',
            surgery_note: 'Tenorrafia FDP 5º dedo',
            access_token: 'tok-abc',
            started_at: '2026-05-01',
            discharged_at: null,
            created_at: '2026-05-01T10:00:00Z',
            updated_at: '2026-05-20T10:00:00Z',
          },
          error: null,
        };
      },
    ];
    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1',
      'PATCH',
      { surgery_date: '2026-05-19', surgery_note: 'Tenorrafia FDP 5º dedo' },
    );
    const res = await patchPatient(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.patient.surgery_date).toBe('2026-05-19');
    expect(body.patient.surgery_note).toBe('Tenorrafia FDP 5º dedo');
  });

  it('clears surgery fields with null (UX-5, 200)', async () => {
    handlers['patients:update'] = [
      ({ args }) => {
        const row = (args[0] ?? {}) as Record<string, unknown>;
        expect(row.surgery_date).toBeNull();
        expect(row.surgery_note).toBeNull();
        return {
          data: {
            id: 'p1',
            external_id: 'HC-001',
            pathology_code: 'flexor',
            injured_finger: 'menique',
            surgery_date: null,
            surgery_note: null,
            access_token: 'tok-abc',
            started_at: '2026-05-01',
            discharged_at: null,
            created_at: '2026-05-01T10:00:00Z',
            updated_at: '2026-05-20T10:00:00Z',
          },
          error: null,
        };
      },
    ];
    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1',
      'PATCH',
      { surgery_date: null, surgery_note: null },
    );
    const res = await patchPatient(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.patient.surgery_date).toBeNull();
    expect(body.patient.surgery_note).toBeNull();
  });

  it('combined update: injured_fingers + surgery_note in one call (200)', async () => {
    // Single array present (injured_fingers) → read-modify-validate against the
    // current amputated_fingers in DB.
    handlers['patients:select'] = [
      () => ({
        data: { injured_fingers: [], amputated_fingers: [] },
        error: null,
      }),
    ];
    handlers['patients:update'] = [
      ({ args }) => {
        const row = (args[0] ?? {}) as Record<string, unknown>;
        expect(row.injured_fingers).toEqual(['anular']);
        expect(row.surgery_note).toBe('Tenorrafia');
        // surgery_date and amputated_fingers not sent → not written.
        expect('surgery_date' in row).toBe(false);
        expect('amputated_fingers' in row).toBe(false);
        return {
          data: {
            id: 'p1',
            external_id: 'HC-001',
            pathology_code: 'flexor',
            injured_fingers: ['anular'],
            amputated_fingers: [],
            surgery_date: null,
            surgery_note: 'Tenorrafia',
            access_token: 'tok-abc',
            started_at: '2026-05-01',
            discharged_at: null,
            created_at: '2026-05-01T10:00:00Z',
            updated_at: '2026-05-20T10:00:00Z',
          },
          error: null,
        };
      },
    ];
    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1',
      'PATCH',
      { injured_fingers: ['anular'], surgery_note: 'Tenorrafia' },
    );
    const res = await patchPatient(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.patient.injured_fingers).toEqual(['anular']);
    expect(body.patient.surgery_note).toBe('Tenorrafia');
  });

  it('400 on empty body {} (UX-5, at least one field required)', async () => {
    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1',
      'PATCH',
      {},
    );
    const res = await patchPatient(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('400 on invalid calendar surgery_date (UX-5)', async () => {
    const req = jsonRequest(
      'http://localhost:3500/api/doctor/patients/p1',
      'PATCH',
      { surgery_date: '2026-02-30' },
    );
    const res = await patchPatient(req, { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(400);
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
