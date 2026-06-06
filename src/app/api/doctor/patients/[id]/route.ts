import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { patchPatientSchema } from '@/lib/validation/patients';
import { errorResponse, zodErrorResponse } from '@/lib/api/errors';

/**
 * B-08 — GET /api/doctor/patients/:id
 *
 * Returns:
 *   - patient row
 *   - active prescriptions (with exercise code/name)
 *   - last 20 sessions (with exercise code via prescription)
 *   - adherence row (may be null when no prescriptions)
 *
 * RLS already filters by doctor_id; we just translate "empty result" into 404.
 *
 * Next.js 16: dynamic route params are async (Promise<{ id: string }>).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const supabase = await createSupabaseServerClient();

  const { data: patient, error: patientErr } = await supabase
    .from('patients')
    .select(
      'id, external_id, pathology_code, injured_finger, access_token, started_at, discharged_at, created_at, updated_at',
    )
    .eq('id', id)
    .maybeSingle();

  if (patientErr) return errorResponse('db_error', 500, patientErr.message);
  if (!patient) return errorResponse('not_found', 404);

  // Active prescriptions: starts_on <= today AND not superseded by a newer one.
  // We approximate "active" as "starts_on <= today AND duration not exceeded".
  // For Fase 1 we just return all prescriptions for the patient; the panel will
  // care about ordering (newest first). The "replaces_id" chain provides
  // auditability without complicating this read.
  const today = new Date().toISOString().slice(0, 10);

  const [prescriptionsRes, sessionsRes, adherenceRes] = await Promise.all([
    supabase
      .from('prescriptions')
      .select(
        'id, patient_id, exercise_id, sets, reps_per_set, sessions_per_day, duration_days, starts_on, replaces_id, created_at, exercise:exercises(id, code, name)',
      )
      .eq('patient_id', id)
      .lte('starts_on', today)
      .order('created_at', { ascending: false }),
    supabase
      .from('sessions')
      .select(
        'id, prescription_id, started_at, ended_at, reps_completed, target_reps, completion_pct, prescription:prescriptions(id, exercise:exercises(id, code, name))',
      )
      .eq('patient_id', id)
      .order('started_at', { ascending: false })
      .limit(20),
    // B-13: pull total + 7d adherence breakdown.
    supabase
      .from('patient_adherence_breakdown')
      .select(
        'total_completed, total_target, total_pct, week_completed, week_target, week_pct',
      )
      .eq('patient_id', id)
      .maybeSingle(),
  ]);

  if (prescriptionsRes.error)
    return errorResponse('db_error', 500, prescriptionsRes.error.message);
  if (sessionsRes.error)
    return errorResponse('db_error', 500, sessionsRes.error.message);
  if (adherenceRes.error)
    return errorResponse('db_error', 500, adherenceRes.error.message);

  const ad = adherenceRes.data as
    | {
        total_completed: number | null;
        total_target: number | null;
        total_pct: number | null;
        week_completed: number | null;
        week_target: number | null;
        week_pct: number | null;
      }
    | null;

  // Backwards-compatible `adherence` shape preserved (existing UI reads
  // {completed_sessions, expected_sessions, adherence_pct}); we add the
  // structured breakdown alongside.
  const adherence = ad
    ? {
        completed_sessions: ad.total_completed ?? 0,
        expected_sessions: ad.total_target ?? 0,
        adherence_pct: ad.total_pct,
        total: {
          completed: ad.total_completed ?? 0,
          target: ad.total_target ?? 0,
          pct: ad.total_pct,
        },
        week: {
          completed: ad.week_completed ?? 0,
          target: ad.week_target ?? 0,
          pct: ad.week_pct,
        },
      }
    : null;

  return NextResponse.json({
    patient,
    prescriptions: prescriptionsRes.data ?? [],
    sessions: sessionsRes.data ?? [],
    adherence,
  });
}

/**
 * UX-4 — PATCH /api/doctor/patients/:id
 *
 * Updates the patient's `injured_finger`. Body: { injured_finger: <finger> | null }
 * (null clears it → NULL = measure the all-fingers average). Strict Zod, exactly
 * this one field for now. RLS filters by doctor_id; an empty update result is
 * translated into 404 (patient not visible to this doctor).
 *
 * Next.js 16: dynamic route params are async (Promise<{ id: string }>).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse('invalid_json', 400, 'Body must be valid JSON');
  }

  let body;
  try {
    body = patchPatientSchema.parse(payload);
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    throw err;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse('unauthenticated', 401);

  const { data: patient, error } = await supabase
    .from('patients')
    .update({ injured_finger: body.injured_finger })
    .eq('id', id)
    .select(
      'id, external_id, pathology_code, injured_finger, access_token, started_at, discharged_at, created_at, updated_at',
    )
    .maybeSingle();

  if (error) return errorResponse('db_error', 500, error.message);
  if (!patient) return errorResponse('not_found', 404);

  return NextResponse.json({ patient });
}
