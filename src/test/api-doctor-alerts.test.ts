import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Tests for B-18 — GET /api/doctor/alerts.
 *
 * Stub mirrors api-doctor-progression.test.ts: Supabase client with chainable
 * builder + an `.rpc(name, args)` queue. The route only calls .rpc, so the
 * builder is mostly unused here, kept for parity.
 */

type QueryResult = { data: unknown; error: unknown };

let rpcResponses: Record<string, QueryResult[]> = {};
let lastRpcArgs: { name: string; args: unknown } | null = null;
let authUser: { id: string } | null = null;

function makeQueryBuilder() {
  const builder: Record<string, unknown> = {};
  const chainMethods = ['eq', 'is', 'not', 'ilike', 'lte', 'gte', 'order', 'limit'];
  for (const m of chainMethods) {
    builder[m] = () => builder;
  }
  builder.select = () => builder;
  builder.maybeSingle = async () => ({ data: null, error: null });
  builder.single = async () => ({ data: null, error: null });
  builder.then = (resolve: (v: QueryResult) => void) =>
    resolve({ data: null, error: null });
  return builder;
}

function makeStubSupabase() {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: authUser } })),
    },
    from: () => ({
      select: () => makeQueryBuilder(),
      insert: () => makeQueryBuilder(),
      update: () => makeQueryBuilder(),
      delete: () => makeQueryBuilder(),
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

import { GET as getAlerts } from '@/app/api/doctor/alerts/route';

function jsonRequest(url: string, method: string) {
  return new NextRequest(url, { method });
}

beforeEach(() => {
  rpcResponses = {};
  lastRpcArgs = null;
  authUser = { id: '00000000-0000-0000-0000-000000000001' };
});

describe('GET /api/doctor/alerts (B-18)', () => {
  it('200 with empty list', async () => {
    rpcResponses['stale_patients'] = [{ data: [], error: null }];

    const req = jsonRequest('http://localhost:3500/api/doctor/alerts', 'GET');
    const res = await getAlerts(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.threshold_hours).toBe(48);
    expect(body.patients).toEqual([]);
    expect(typeof body.generated_at).toBe('string');
    expect(lastRpcArgs?.name).toBe('stale_patients');
    expect((lastRpcArgs?.args as { p_threshold_hours: number }).p_threshold_hours).toBe(48);
    expect((lastRpcArgs?.args as { p_doctor_id: string }).p_doctor_id).toBe(
      authUser!.id,
    );
  });

  it('200 with 3 stale patients sorted desc by hours_since_last (includes open-ended)', async () => {
    rpcResponses['stale_patients'] = [
      {
        data: [
          // Returned out of order; route must sort desc.
          {
            patient_id: 'p-recent',
            external_id: 'HC-002',
            pathology_code: 'extensor',
            last_session_at: '2026-05-07T08:00:00Z',
            hours_since_last: 60,
            has_ever_session: true,
          },
          {
            patient_id: 'p-never',
            external_id: 'HC-001',
            pathology_code: null,
            last_session_at: null,
            hours_since_last: 500000,
            has_ever_session: false,
          },
          // Bugfix 2026-05-11: this patient's only prescription has
          // duration_days = NULL (open-ended). The stale_patients SQL
          // function must treat it as active and surface it here.
          {
            patient_id: 'p-open-ended',
            external_id: 'HC-003',
            pathology_code: 'flexor',
            last_session_at: '2026-05-05T10:00:00Z',
            hours_since_last: 140,
            has_ever_session: true,
          },
        ],
        error: null,
      },
    ];

    const req = jsonRequest(
      'http://localhost:3500/api/doctor/alerts?threshold_hours=48',
      'GET',
    );
    const res = await getAlerts(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.threshold_hours).toBe(48);
    expect(body.patients).toHaveLength(3);
    expect(body.patients[0].patient_id).toBe('p-never');
    expect(body.patients[0].has_ever_session).toBe(false);
    expect(body.patients[1].patient_id).toBe('p-open-ended');
    expect(body.patients[1].hours_since_last).toBe(140);
    expect(body.patients[2].patient_id).toBe('p-recent');
    expect(body.patients[2].hours_since_last).toBe(60);
  });

  it('400 when threshold_hours is out of range', async () => {
    const req = jsonRequest(
      'http://localhost:3500/api/doctor/alerts?threshold_hours=0',
      'GET',
    );
    const res = await getAlerts(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_body');
  });

  it('400 when threshold_hours is not a number', async () => {
    const req = jsonRequest(
      'http://localhost:3500/api/doctor/alerts?threshold_hours=abc',
      'GET',
    );
    const res = await getAlerts(req);
    expect(res.status).toBe(400);
  });
});
