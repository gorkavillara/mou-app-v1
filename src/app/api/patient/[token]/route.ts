import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { patientTokenSchema } from '@/lib/validation/patients';
import { errorResponse } from '@/lib/api/errors';

/**
 * B-11 — GET /api/patient/[token]
 *
 * Public endpoint. The patient is authenticated via an opaque `access_token`
 * embedded in the URL (D7). We use the service-role client to bypass RLS,
 * so this handler MUST NEVER use the user-bound supabase server client.
 *
 * Behavior:
 *   - 200: returns patient + active prescriptions (with exercise) + today summary
 *   - 404: token shape invalid OR no patient with that token
 *   - 410: patient discharged OR every prescription has expired
 *   - 500: db error
 *
 * "Active prescription" = patient is not discharged AND
 *   starts_on <= today < starts_on + duration_days.
 *
 * Forced dynamic: this reads time-sensitive data (today's session count, active
 * prescription window) — Next.js must NOT cache it.
 */
export const dynamic = 'force-dynamic';

type ExerciseRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  animation_url: string | null;
  tracked_joints: string[];
  target_finger: string;
};

type PrescriptionRow = {
  id: string;
  exercise_id: string;
  sets: number;
  reps_per_set: number;
  sessions_per_day: number;
  duration_days: number;
  starts_on: string;
  exercise: ExerciseRow | ExerciseRow[] | null;
};

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfTodayUTCISO(): string {
  const today = new Date();
  return new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  ).toISOString();
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  // Validate token shape. Anything malformed → 404 (don't leak format).
  const parsed = patientTokenSchema.safeParse(token);
  if (!parsed.success) {
    return errorResponse('not_found', 404);
  }

  const admin = getSupabaseAdmin();

  // Resolve patient by token.
  const { data: patient, error: patientErr } = await admin
    .from('patients')
    .select(
      'id, external_id, pathology_code, started_at, discharged_at',
    )
    .eq('access_token', parsed.data)
    .maybeSingle();

  if (patientErr) return errorResponse('db_error', 500, patientErr.message);
  if (!patient) return errorResponse('not_found', 404);

  // Discharged → tratamiento finalizado.
  if (patient.discharged_at) {
    return errorResponse('tratamiento_finalizado', 410);
  }

  const today = todayISO();

  // Fetch all prescriptions for this patient that have already started.
  const { data: rawPrescriptions, error: rxErr } = await admin
    .from('prescriptions')
    .select(
      'id, exercise_id, sets, reps_per_set, sessions_per_day, duration_days, starts_on, exercise:exercises(id, code, name, description, animation_url, tracked_joints, target_finger)',
    )
    .eq('patient_id', patient.id)
    .lte('starts_on', today);

  if (rxErr) return errorResponse('db_error', 500, rxErr.message);

  const prescriptions = ((rawPrescriptions ?? []) as PrescriptionRow[])
    .filter((p) => {
      // Active if today < starts_on + duration_days.
      const endsOn = addDaysISO(p.starts_on, p.duration_days);
      return today < endsOn;
    })
    .map((p) => {
      // Supabase joins one-to-many style returns either object or array;
      // normalize to a single object (foreign key is single-valued).
      const exercise = Array.isArray(p.exercise) ? p.exercise[0] ?? null : p.exercise;
      return {
        id: p.id,
        exercise_id: p.exercise_id,
        sets: p.sets,
        reps_per_set: p.reps_per_set,
        sessions_per_day: p.sessions_per_day,
        duration_days: p.duration_days,
        starts_on: p.starts_on,
        ends_on: addDaysISO(p.starts_on, p.duration_days),
        exercise,
      };
    });

  if (prescriptions.length === 0) {
    return errorResponse('tratamiento_finalizado', 410);
  }

  // Today's session count. Filter by started_at >= start-of-today (UTC).
  const sessionsTarget = prescriptions.reduce(
    (acc, p) => acc + p.sessions_per_day,
    0,
  );

  const { count: sessionsCompleted, error: countErr } = await admin
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patient.id)
    .gte('started_at', startOfTodayUTCISO());

  if (countErr) return errorResponse('db_error', 500, countErr.message);

  return NextResponse.json(
    {
      patient: {
        id: patient.id,
        external_id: patient.external_id,
        pathology_code: patient.pathology_code,
        started_at: patient.started_at,
        discharged_at: patient.discharged_at,
      },
      prescriptions,
      today: {
        sessions_completed: sessionsCompleted ?? 0,
        sessions_target: sessionsTarget,
      },
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
