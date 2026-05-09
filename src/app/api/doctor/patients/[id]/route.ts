import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { errorResponse } from '@/lib/api/errors';

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
      'id, external_id, pathology_code, access_token, started_at, discharged_at, created_at, updated_at',
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
    supabase
      .from('patient_adherence')
      .select('completed_sessions, expected_sessions, adherence_pct')
      .eq('patient_id', id)
      .maybeSingle(),
  ]);

  if (prescriptionsRes.error)
    return errorResponse('db_error', 500, prescriptionsRes.error.message);
  if (sessionsRes.error)
    return errorResponse('db_error', 500, sessionsRes.error.message);
  if (adherenceRes.error)
    return errorResponse('db_error', 500, adherenceRes.error.message);

  return NextResponse.json({
    patient,
    prescriptions: prescriptionsRes.data ?? [],
    sessions: sessionsRes.data ?? [],
    adherence: adherenceRes.data ?? null,
  });
}
