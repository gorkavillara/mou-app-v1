import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createPrescriptionSchema } from '@/lib/validation/patients';
import { errorResponse, zodErrorResponse } from '@/lib/api/errors';

/**
 * B-09 — POST /api/doctor/patients/:id/prescriptions
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: patientId } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse('invalid_json', 400, 'Body must be valid JSON');
  }

  let body;
  try {
    body = createPrescriptionSchema.parse(payload);
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    throw err;
  }

  const supabase = await createSupabaseServerClient();

  // 404 if patient is not visible (RLS filters by doctor_id).
  const { data: patient, error: patientErr } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .maybeSingle();
  if (patientErr) return errorResponse('db_error', 500, patientErr.message);
  if (!patient) return errorResponse('not_found', 404);

  // Validate exercise_id exists. The exercises catalog is readable by any
  // authenticated user (RLS exercises_select_authenticated).
  const { data: exercise, error: exErr } = await supabase
    .from('exercises')
    .select('id')
    .eq('id', body.exercise_id)
    .maybeSingle();
  if (exErr) return errorResponse('db_error', 500, exErr.message);
  if (!exercise) {
    return errorResponse(
      'invalid_exercise',
      400,
      'exercise_id does not exist',
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: prescription, error: insErr } = await supabase
    .from('prescriptions')
    .insert({
      patient_id: patientId,
      exercise_id: body.exercise_id,
      sets: body.sets,
      reps_per_set: body.reps_per_set,
      sessions_per_day: body.sessions_per_day,
      duration_days: body.duration_days,
      starts_on: body.starts_on ?? today,
    })
    .select(
      'id, patient_id, exercise_id, sets, reps_per_set, sessions_per_day, duration_days, starts_on, replaces_id, created_at',
    )
    .single();

  if (insErr) return errorResponse('db_error', 500, insErr.message);

  return NextResponse.json({ prescription }, { status: 201 });
}
