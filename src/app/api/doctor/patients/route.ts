import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  createPatientSchema,
  listPatientsQuerySchema,
} from '@/lib/validation/patients';
import { errorResponse, zodErrorResponse } from '@/lib/api/errors';

/**
 * B-06 — POST /api/doctor/patients
 *
 * Create a patient for the authenticated doctor. The middleware has already
 * gated this route (401/403). RLS enforces doctor_id = auth.uid(); we rely on
 * that as source of truth.
 */
export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse('invalid_json', 400, 'Body must be valid JSON');
  }

  let body;
  try {
    body = createPatientSchema.parse(payload);
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
    .insert({
      doctor_id: user.id,
      external_id: body.external_id,
      pathology_code: body.pathology_code ?? null,
    })
    .select(
      'id, doctor_id, external_id, pathology_code, access_token, started_at, discharged_at, created_at, updated_at',
    )
    .single();

  if (error) {
    // 23505 = unique_violation. The relevant constraint here is
    // unique (doctor_id, external_id).
    if (error.code === '23505') {
      return errorResponse(
        'duplicate_external_id',
        409,
        'A patient with that external_id already exists for this doctor',
      );
    }
    return errorResponse('db_error', 500, error.message);
  }

  const origin = request.nextUrl.origin;
  const public_url = `${origin}/p/${patient.access_token}`;

  return NextResponse.json({ patient, public_url }, { status: 201 });
}

/**
 * B-07 — GET /api/doctor/patients
 *
 * List patients for the authenticated doctor. Adherence is joined client-side
 * because `patient_adherence` is a view that only includes patients with at
 * least one prescription (LEFT JOIN at the SQL level would still need a view
 * or RPC; doing two parallel queries keeps the route honest and the types simple).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  let query;
  try {
    query = listPatientsQuerySchema.parse({
      search: url.searchParams.get('search') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
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

  // Build patients query.
  let q = supabase
    .from('patients')
    .select(
      'id, external_id, pathology_code, started_at, discharged_at',
    );

  if (query.status === 'active') q = q.is('discharged_at', null);
  if (query.status === 'discharged') q = q.not('discharged_at', 'is', null);
  if (query.search && query.search.length > 0) {
    // Escape % and _ to avoid wildcard injection.
    const safe = query.search.replace(/[%_\\]/g, (m) => `\\${m}`);
    q = q.ilike('external_id', `%${safe}%`);
  }

  // Sort: active first (discharged_at IS NULL → top), then by started_at desc.
  // Supabase JS doesn't support `IS NULL FIRST/LAST` directly, so we sort by
  // `discharged_at` with nullsFirst:true (nulls = active = first) ascending.
  q = q
    .order('discharged_at', { ascending: true, nullsFirst: true })
    .order('started_at', { ascending: false });

  const [patientsRes, adherenceRes] = await Promise.all([
    q,
    supabase
      .from('patient_adherence')
      .select(
        'patient_id, completed_sessions, expected_sessions, adherence_pct',
      ),
  ]);

  if (patientsRes.error) {
    return errorResponse('db_error', 500, patientsRes.error.message);
  }
  if (adherenceRes.error) {
    return errorResponse('db_error', 500, adherenceRes.error.message);
  }

  const adherenceByPatient = new Map<
    string,
    { completed_sessions: number; expected_sessions: number; adherence_pct: number }
  >();
  for (const a of adherenceRes.data ?? []) {
    adherenceByPatient.set(a.patient_id, {
      completed_sessions: a.completed_sessions,
      expected_sessions: a.expected_sessions,
      adherence_pct: a.adherence_pct,
    });
  }

  const patients = (patientsRes.data ?? []).map((p) => {
    const ad = adherenceByPatient.get(p.id);
    return {
      id: p.id,
      external_id: p.external_id,
      pathology_code: p.pathology_code,
      started_at: p.started_at,
      discharged_at: p.discharged_at,
      adherence_pct: ad?.adherence_pct ?? null,
      completed_sessions: ad?.completed_sessions ?? 0,
      expected_sessions: ad?.expected_sessions ?? 0,
    };
  });

  return NextResponse.json({ patients });
}
