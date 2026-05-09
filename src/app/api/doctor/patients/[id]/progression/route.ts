import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { progressionQuerySchema } from '@/lib/validation/patients';
import { errorResponse, zodErrorResponse } from '@/lib/api/errors';

/**
 * B-14 — GET /api/doctor/patients/:id/progression
 *
 * Returns a per-day, per-joint aggregate of max flexion / extension so the
 * doctor panel can plot one line per joint.
 *
 * Query params (all optional):
 *   - from=YYYY-MM-DD (default: patient.started_at)
 *   - to=YYYY-MM-DD   (default: today)
 *   - joint=...       (repeatable; if absent, all joints)
 *
 * Implementation: a SQL function `patient_progression(patient, from, to,
 * joints[])` that filters in the plan and excludes low_*-flagged reps from
 * the max/min while still counting them in `samples`. We chose a function
 * over a view because we need to parameterise patient_id + window; a global
 * view would force the API to filter post-hoc and lose index pushdown.
 *
 * Auth: middleware gates /api/doctor/* (401/403). Inside, RLS ensures the
 * caller only sees their own patients; we map "patient not visible" to 404.
 *
 * Next.js 16: dynamic params are async (Promise<{ id: string }>).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: patientId } = await context.params;

  const url = request.nextUrl;
  const joints = url.searchParams.getAll('joint');

  let query;
  try {
    query = progressionQuerySchema.parse({
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      joint: joints.length > 0 ? joints : undefined,
    });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    throw err;
  }

  const supabase = await createSupabaseServerClient();

  // 404 if the patient is not visible. RLS would return 0 rows from the
  // function, which we couldn't distinguish from "no measurements yet".
  const { data: patient, error: patientErr } = await supabase
    .from('patients')
    .select('id, started_at')
    .eq('id', patientId)
    .maybeSingle();

  if (patientErr) return errorResponse('db_error', 500, patientErr.message);
  if (!patient) return errorResponse('not_found', 404);

  const today = new Date().toISOString().slice(0, 10);
  const from = query.from ?? patient.started_at;
  const to = query.to ?? today;

  const { data: rows, error: rpcErr } = await supabase.rpc(
    'patient_progression',
    {
      p_patient_id: patientId,
      p_from: from,
      p_to: to,
      p_joints: query.joint ?? null,
    },
  );

  if (rpcErr) return errorResponse('db_error', 500, rpcErr.message);

  // Group by joint → array of { day, max_flexion, max_extension, samples }.
  type Row = {
    day: string;
    joint: string;
    max_flexion: number | null;
    max_extension: number | null;
    samples: number;
  };
  const byJoint = new Map<string, Row[]>();
  for (const r of (rows ?? []) as Row[]) {
    const arr = byJoint.get(r.joint) ?? [];
    arr.push(r);
    byJoint.set(r.joint, arr);
  }

  const series = Array.from(byJoint.entries()).map(([joint, points]) => ({
    joint,
    points: points.map((p) => ({
      day: p.day,
      max_flexion: p.max_flexion,
      max_extension: p.max_extension,
      samples: p.samples,
    })),
  }));

  return NextResponse.json({ from, to, series });
}
