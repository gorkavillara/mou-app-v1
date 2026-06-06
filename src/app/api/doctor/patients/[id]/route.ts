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
      'id, external_id, pathology_code, injured_fingers, amputated_fingers, surgery_date, surgery_note, access_token, started_at, discharged_at, created_at, updated_at',
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
 * FB-1 + UX-5 — PATCH /api/doctor/patients/:id
 *
 * Updates a non-empty subset of the clinical-record fields:
 *   { injured_fingers?: FingerName[], amputated_fingers?: FingerName[],
 *     surgery_date?: 'YYYY-MM-DD'|null, surgery_note?: string|null }
 *
 * Arrays are FULL REPLACEMENT (send `[]` to clear — no null for arrays). For
 * dates/notes, `null` clears. At least one key is required (`{}` → 400, enforced
 * by the schema's refine). Strict Zod rejects any other field, including the
 * legacy `injured_finger` (D3). Only the keys present in the body are written,
 * so a PATCH never clobbers a field the caller didn't mention.
 *
 * No-overlap between injured/amputated: when BOTH arrays are present the schema
 * refine catches it. When only ONE is sent, we read the OTHER array's current
 * DB value and validate the union has no overlap BEFORE writing
 * (read-modify-validate). As a backstop, the DB constraint `fingers_no_overlap`
 * would raise 23514; we map that to the same clean 400 `fingers_overlap`.
 *
 * RLS filters by doctor_id; an empty update result is translated into 404.
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

  // Build the update from only the keys actually present in the body, so a
  // partial PATCH never clobbers a field the caller didn't mention. The schema
  // already guarantees at least one key (rejects `{}`).
  const update: {
    injured_fingers?: typeof body.injured_fingers;
    amputated_fingers?: typeof body.amputated_fingers;
    surgery_date?: typeof body.surgery_date;
    surgery_note?: typeof body.surgery_note;
  } = {};
  if ('injured_fingers' in body) update.injured_fingers = body.injured_fingers;
  if ('amputated_fingers' in body)
    update.amputated_fingers = body.amputated_fingers;
  if ('surgery_date' in body) update.surgery_date = body.surgery_date;
  if ('surgery_note' in body) update.surgery_note = body.surgery_note;

  // FB-1: single-array overlap check (read-modify-validate). When exactly ONE
  // of the two finger arrays is being changed, validate it against the OTHER
  // array's CURRENT DB value (the schema refine only fires when both are in the
  // same request). The DB constraint is a backstop; we prefer a clean 400.
  const onlyInjured =
    'injured_fingers' in body && !('amputated_fingers' in body);
  const onlyAmputated =
    'amputated_fingers' in body && !('injured_fingers' in body);
  if (onlyInjured || onlyAmputated) {
    const { data: current, error: readErr } = await supabase
      .from('patients')
      .select('injured_fingers, amputated_fingers')
      .eq('id', id)
      .maybeSingle();
    if (readErr) return errorResponse('db_error', 500, readErr.message);
    if (!current) return errorResponse('not_found', 404);

    const cur = current as {
      injured_fingers: string[] | null;
      amputated_fingers: string[] | null;
    };
    const injured: string[] = onlyInjured
      ? body.injured_fingers ?? []
      : cur.injured_fingers ?? [];
    const amputated: string[] = onlyAmputated
      ? body.amputated_fingers ?? []
      : cur.amputated_fingers ?? [];
    const injuredSet = new Set(injured);
    if (amputated.some((f) => injuredSet.has(f))) {
      return errorResponse(
        'fingers_overlap',
        400,
        'a finger cannot be both injured and amputated',
      );
    }
  }

  const { data: patient, error } = await supabase
    .from('patients')
    .update(update)
    .eq('id', id)
    .select(
      'id, external_id, pathology_code, injured_fingers, amputated_fingers, surgery_date, surgery_note, access_token, started_at, discharged_at, created_at, updated_at',
    )
    .maybeSingle();

  if (error) {
    // 23514 = check_violation. The relevant constraint is fingers_no_overlap;
    // map it to a clean 400 instead of leaking a raw 500.
    if (error.code === '23514' && /fingers_no_overlap/.test(error.message ?? '')) {
      return errorResponse(
        'fingers_overlap',
        400,
        'a finger cannot be both injured and amputated',
      );
    }
    return errorResponse('db_error', 500, error.message);
  }
  if (!patient) return errorResponse('not_found', 404);

  return NextResponse.json({ patient });
}
