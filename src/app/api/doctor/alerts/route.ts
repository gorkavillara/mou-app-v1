import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { alertsQuerySchema } from '@/lib/validation/patients';
import { errorResponse, zodErrorResponse } from '@/lib/api/errors';

/**
 * B-18 — GET /api/doctor/alerts
 *
 * Lists the doctor's "stale" patients: active patients (not discharged, with at
 * least one prescription vigent today) whose last session is older than the
 * threshold (default 48h), or who have never sessioned.
 *
 * The heavy lifting is in the SQL function `stale_patients(doctor, hours)`;
 * the route just validates the query, calls the function with `auth.uid()` as
 * the doctor, and shapes the JSON response.
 *
 * Sorted by `hours_since_last desc` — i.e. patients without any session bubble
 * to the top because their `coalesce(..., epoch 0)` makes hours_since_last
 * astronomical, which matches the doctor's intent ("who have I lost track of").
 *
 * `force-dynamic` because the result depends on `now()`.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  let query;
  try {
    query = alertsQuerySchema.parse({
      threshold_hours: url.searchParams.get('threshold_hours') ?? undefined,
    });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    throw err;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorResponse('unauthenticated', 401);

  const { data: rows, error } = await supabase.rpc('stale_patients', {
    p_doctor_id: user.id,
    p_threshold_hours: query.threshold_hours,
  });

  if (error) return errorResponse('db_error', 500, error.message);

  type Row = {
    patient_id: string;
    external_id: string;
    pathology_code: string | null;
    last_session_at: string | null;
    hours_since_last: number;
    has_ever_session: boolean;
  };

  const patients = ((rows ?? []) as Row[])
    .map((r) => ({
      patient_id: r.patient_id,
      external_id: r.external_id,
      pathology_code: r.pathology_code,
      last_session_at: r.last_session_at,
      hours_since_last: Number(r.hours_since_last),
      has_ever_session: r.has_ever_session,
    }))
    .sort((a, b) => b.hours_since_last - a.hours_since_last);

  return NextResponse.json({
    threshold_hours: query.threshold_hours,
    generated_at: new Date().toISOString(),
    patients,
  });
}
