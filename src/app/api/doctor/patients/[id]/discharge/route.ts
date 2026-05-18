import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { errorResponse } from '@/lib/api/errors';

/**
 * B-10 — POST /api/doctor/patients/:id/discharge
 *
 * Idempotent: if the patient is already discharged, returns the current state
 * with status 200 (not 409). Only flips NULL → today; never overwrites a
 * previous discharge date.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const supabase = await createSupabaseServerClient();

  const { data: patient, error: patientErr } = await supabase
    .from('patients')
    .select('id, external_id, started_at, discharged_at')
    .eq('id', id)
    .maybeSingle();

  if (patientErr) return errorResponse('db_error', 500, patientErr.message);
  if (!patient) return errorResponse('not_found', 404);

  // Already discharged → idempotent return.
  if (patient.discharged_at) {
    return NextResponse.json({ patient, already_discharged: true });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: updated, error: updErr } = await supabase
    .from('patients')
    .update({ discharged_at: today })
    .eq('id', id)
    .select('id, external_id, started_at, discharged_at')
    .single();

  if (updErr) return errorResponse('db_error', 500, updErr.message);

  return NextResponse.json({ patient: updated, already_discharged: false });
}
