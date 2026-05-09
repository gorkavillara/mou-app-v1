import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Tests for B-14 — GET /api/doctor/patients/:id/progression.
 *
 * Stub mirrors api-doctor-patients.test.ts but adds `.rpc(name, args)`
 * since the route reads aggregated rows via the SQL function
 * `patient_progression`.
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
let rpcResponses: Record<string, QueryResult[]> = {};
let lastRpcArgs: { name: string; args: unknown } | null = null;

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
    rpc: vi.fn(async (name: string, args: unknown) => {
      lastRpcArgs = { name, args };
      const queue = rpcResponses[name];
      if (!queue || queue.length === 0) {
        return { data: null, error: { message: `no rpc handler for ${name}` } };
      }
      return queue.shift()!;
    }),
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => makeStubSupabase()),
}));

import { GET as getProgression } from '@/app/api/doctor/patients/[id]/progression/route';

function jsonRequest(url: string, method: string) {
  return new NextRequest(url, { method });
}

beforeEach(() => {
  handlers = {};
  rpcResponses = {};
  lastRpcArgs = null;
});

const PATIENT_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

describe('GET /api/doctor/patients/:id/progression (B-14)', () => {
  it('200 happy path: groups rows by joint and falls back to patient.started_at', async () => {
    handlers['patients:select'] = [
      () => ({
        data: { id: PATIENT_ID, started_at: '2026-04-25' },
        error: null,
      }),
    ];
    rpcResponses['patient_progression'] = [
      {
        data: [
          { day: '2026-04-25', joint: 'MCP', max_flexion: 78, max_extension: -2, samples: 14 },
          { day: '2026-04-26', joint: 'MCP', max_flexion: 82, max_extension: -1, samples: 16 },
          { day: '2026-04-25', joint: 'PIP', max_flexion: 92, max_extension: 0, samples: 14 },
        ],
        error: null,
      },
    ];

    const req = jsonRequest(
      `http://localhost:3500/api/doctor/patients/${PATIENT_ID}/progression`,
      'GET',
    );
    const res = await getProgression(req, {
      params: Promise.resolve({ id: PATIENT_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.from).toBe('2026-04-25');
    expect(typeof body.to).toBe('string');
    expect(body.series).toHaveLength(2);

    const mcp = body.series.find((s: { joint: string }) => s.joint === 'MCP');
    expect(mcp.points).toHaveLength(2);
    expect(mcp.points[0]).toEqual({
      day: '2026-04-25',
      max_flexion: 78,
      max_extension: -2,
      samples: 14,
    });

    expect(lastRpcArgs?.name).toBe('patient_progression');
    expect((lastRpcArgs?.args as { p_joints: unknown }).p_joints).toBeNull();
  });

  it('forwards joint filter to the RPC', async () => {
    handlers['patients:select'] = [
      () => ({ data: { id: PATIENT_ID, started_at: '2026-04-25' }, error: null }),
    ];
    rpcResponses['patient_progression'] = [{ data: [], error: null }];

    const req = jsonRequest(
      `http://localhost:3500/api/doctor/patients/${PATIENT_ID}/progression?joint=MCP-index&joint=PIP-index`,
      'GET',
    );
    const res = await getProgression(req, {
      params: Promise.resolve({ id: PATIENT_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.series).toEqual([]);
    expect((lastRpcArgs?.args as { p_joints: string[] }).p_joints).toEqual([
      'MCP-index',
      'PIP-index',
    ]);
  });

  it('empty data → empty series', async () => {
    handlers['patients:select'] = [
      () => ({ data: { id: PATIENT_ID, started_at: '2026-04-25' }, error: null }),
    ];
    rpcResponses['patient_progression'] = [{ data: [], error: null }];

    const req = jsonRequest(
      `http://localhost:3500/api/doctor/patients/${PATIENT_ID}/progression`,
      'GET',
    );
    const res = await getProgression(req, {
      params: Promise.resolve({ id: PATIENT_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.series).toEqual([]);
  });

  it('404 when patient not visible', async () => {
    handlers['patients:select'] = [() => ({ data: null, error: null })];

    const req = jsonRequest(
      `http://localhost:3500/api/doctor/patients/${PATIENT_ID}/progression`,
      'GET',
    );
    const res = await getProgression(req, {
      params: Promise.resolve({ id: PATIENT_ID }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });

  it('400 when from > to', async () => {
    const req = jsonRequest(
      `http://localhost:3500/api/doctor/patients/${PATIENT_ID}/progression?from=2026-05-09&to=2026-05-01`,
      'GET',
    );
    const res = await getProgression(req, {
      params: Promise.resolve({ id: PATIENT_ID }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('400 when from is not YYYY-MM-DD', async () => {
    const req = jsonRequest(
      `http://localhost:3500/api/doctor/patients/${PATIENT_ID}/progression?from=05-09-2026`,
      'GET',
    );
    const res = await getProgression(req, {
      params: Promise.resolve({ id: PATIENT_ID }),
    });
    expect(res.status).toBe(400);
  });
});
