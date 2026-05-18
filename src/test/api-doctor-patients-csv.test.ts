import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Tests for B-19 — GET /api/doctor/patients/:id/export.csv.
 *
 * Stub mirrors api-doctor-patients.test.ts. We only need .from(...).select
 * with chainable .eq / .order / .maybeSingle.
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

function makeStubSupabase() {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: '00000000-0000-0000-0000-000000000001' } },
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

import { GET as getCsv } from '@/app/api/doctor/patients/[id]/export.csv/route';

function jsonRequest(url: string, method: string) {
  return new NextRequest(url, { method });
}

beforeEach(() => {
  handlers = {};
});

const PATIENT_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

describe('GET /api/doctor/patients/:id/export.csv (B-19)', () => {
  it('200 returns text/csv with correct header line and Content-Disposition', async () => {
    handlers['patients:select'] = [
      () => ({
        data: { id: PATIENT_ID, external_id: 'HC-001' },
        error: null,
      }),
    ];
    handlers['sessions:select'] = [
      () => ({
        data: [
          {
            id: 's1',
            started_at: '2026-05-08T10:00:00Z',
            ended_at: '2026-05-08T10:05:00Z',
            prescription_id: 'pr1',
            prescription: {
              id: 'pr1',
              sets: 3,
              reps_per_set: 20,
              sessions_per_day: 4,
              exercise: { code: 'flexion-pasiva-dedos' },
            },
            rep_measurements: [
              {
                rep_index: 2,
                joint: 'PIP-index',
                max_flexion_deg: 92,
                max_extension_deg: 0,
                quality_flag: 'clean',
              },
              {
                rep_index: 1,
                joint: 'MCP-index',
                max_flexion_deg: 78,
                max_extension_deg: -2,
                quality_flag: null,
              },
            ],
          },
        ],
        error: null,
      }),
    ];

    const req = jsonRequest(
      `http://localhost:3500/api/doctor/patients/${PATIENT_ID}/export.csv`,
      'GET',
    );
    const res = await getCsv(req, {
      params: Promise.resolve({ id: PATIENT_ID }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    const cd = res.headers.get('content-disposition');
    expect(cd).toContain('attachment; filename="mou-HC-001-');
    expect(cd).toContain('.csv"');
    expect(res.headers.get('cache-control')).toBe('private, no-store');

    // Verify the UTF-8 BOM (EF BB BF) is the first three bytes of the body.
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);
    const text = new TextDecoder('utf-8').decode(bytes.slice(3));
    const lines = text.split('\r\n').filter((l) => l.length > 0);
    expect(lines[0]).toBe(
      'patient_external_id,session_id,session_started_at,session_ended_at,exercise_code,prescription_id,sets,reps_per_set,sessions_per_day,rep_index,joint,max_flexion_deg,max_extension_deg,quality_flag',
    );
    // Sorted by (rep_index asc, joint asc) within session.
    expect(lines[1].startsWith('HC-001,s1,2026-05-08T10:00:00Z,2026-05-08T10:05:00Z,flexion-pasiva-dedos,pr1,3,20,4,1,MCP-index,78,-2,')).toBe(true);
    expect(lines[2]).toContain(',2,PIP-index,92,0,clean');
  });

  it('escapes quotes in external_id correctly (RFC 4180)', async () => {
    handlers['patients:select'] = [
      () => ({
        data: { id: PATIENT_ID, external_id: 'HC"01' },
        error: null,
      }),
    ];
    handlers['sessions:select'] = [
      () => ({
        data: [
          {
            id: 's1',
            started_at: '2026-05-08T10:00:00Z',
            ended_at: null,
            prescription_id: 'pr1',
            prescription: {
              id: 'pr1',
              sets: 1,
              reps_per_set: 1,
              sessions_per_day: 1,
              exercise: { code: 'flexion-pasiva-dedos' },
            },
            rep_measurements: [
              {
                rep_index: 1,
                joint: 'MCP-index',
                max_flexion_deg: 80,
                max_extension_deg: 0,
                quality_flag: null,
              },
            ],
          },
        ],
        error: null,
      }),
    ];

    const req = jsonRequest(
      `http://localhost:3500/api/doctor/patients/${PATIENT_ID}/export.csv`,
      'GET',
    );
    const res = await getCsv(req, {
      params: Promise.resolve({ id: PATIENT_ID }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    // First data row should start with the quoted, doubled value.
    expect(text).toContain('"HC""01",s1,');
  });

  it('404 when patient not visible', async () => {
    handlers['patients:select'] = [() => ({ data: null, error: null })];

    const req = jsonRequest(
      `http://localhost:3500/api/doctor/patients/${PATIENT_ID}/export.csv`,
      'GET',
    );
    const res = await getCsv(req, {
      params: Promise.resolve({ id: PATIENT_ID }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });
});
