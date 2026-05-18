import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  createSessionSchema,
  patientTokenSchema,
} from '@/lib/validation/patients';
import { errorResponse, zodErrorResponse } from '@/lib/api/errors';

/**
 * B-12 — POST /api/patient/[token]/sessions
 *
 * Records the result of a tracking session (sessions row + N rep_measurements).
 *
 * Auth: opaque token in the URL, resolved via service-role client (RLS bypass).
 *
 * Behavior:
 *   - 201: session created, returns { session: { id, completion_pct } }
 *   - 400: invalid body OR prescription_id doesn't belong to this patient
 *   - 404: token unknown / malformed
 *   - 410: patient discharged
 *   - 500: db error (insert failure → we attempt to roll back the session row)
 *
 * "Transaction" caveat: Supabase's PostgREST does not expose multi-statement
 * transactions over HTTP. We insert the session, then insert all measurements;
 * if measurements fail we delete the session to avoid orphan rows. A proper
 * RPC could wrap both in a single tx — out of scope for B-12.
 */
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  const parsedToken = patientTokenSchema.safeParse(token);
  if (!parsedToken.success) {
    return errorResponse('not_found', 404);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse('invalid_json', 400, 'Body must be valid JSON');
  }

  let body;
  try {
    body = createSessionSchema.parse(payload);
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    throw err;
  }

  const admin = getSupabaseAdmin();

  const { data: patient, error: patientErr } = await admin
    .from('patients')
    .select('id, discharged_at')
    .eq('access_token', parsedToken.data)
    .maybeSingle();

  if (patientErr) return errorResponse('db_error', 500, patientErr.message);
  if (!patient) return errorResponse('not_found', 404);
  if (patient.discharged_at) {
    return errorResponse('tratamiento_finalizado', 410);
  }

  // Verify prescription belongs to this patient (anti-forgery).
  const { data: prescription, error: rxErr } = await admin
    .from('prescriptions')
    .select('id, patient_id')
    .eq('id', body.prescription_id)
    .maybeSingle();

  if (rxErr) return errorResponse('db_error', 500, rxErr.message);
  if (!prescription || prescription.patient_id !== patient.id) {
    return errorResponse(
      'invalid_prescription',
      400,
      'prescription_id does not belong to this patient',
    );
  }

  // Insert session.
  const { data: session, error: sessionErr } = await admin
    .from('sessions')
    .insert({
      patient_id: patient.id,
      prescription_id: body.prescription_id,
      started_at: body.started_at,
      ended_at: body.ended_at,
      reps_completed: body.reps_completed,
      target_reps: body.target_reps,
      client_metadata: body.client_metadata ?? null,
    })
    .select('id, completion_pct')
    .single();

  if (sessionErr) return errorResponse('db_error', 500, sessionErr.message);

  // Insert rep_measurements (if any).
  if (body.rep_measurements.length > 0) {
    const rows = body.rep_measurements.map((m) => ({
      session_id: session.id,
      rep_index: m.rep_index,
      joint: m.joint,
      max_flexion_deg: m.max_flexion_deg ?? null,
      max_extension_deg: m.max_extension_deg ?? null,
      quality_flag: m.quality_flag ?? null,
    }));

    const { error: measErr } = await admin
      .from('rep_measurements')
      .insert(rows);

    if (measErr) {
      // Best-effort rollback: delete the session row we just created.
      await admin.from('sessions').delete().eq('id', session.id);
      return errorResponse('db_error', 500, measErr.message);
    }
  }

  return NextResponse.json(
    {
      session: {
        id: session.id,
        completion_pct: session.completion_pct,
      },
    },
    { status: 201 },
  );
}
