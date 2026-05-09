import 'server-only';
import { headers, cookies } from 'next/headers';
import type { PathologyCode, TrackedJoint } from './database.types';

/**
 * Doctor API client (server-side only).
 *
 * Wraps fetch() against our own /api/doctor/* routes, forwarding cookies so the
 * Supabase session is preserved. Types here mirror the actual route responses
 * (see src/app/api/doctor/...) — keep in sync if the contract changes.
 */

export type StatusFilter = 'all' | 'active' | 'discharged';

// --- List ------------------------------------------------------------------

export type PatientListItem = {
  id: string;
  external_id: string;
  pathology_code: PathologyCode | null;
  started_at: string;
  discharged_at: string | null;
  adherence_pct: number | null;
  completed_sessions: number;
  expected_sessions: number;
};

export type PatientListResponse = {
  patients: PatientListItem[];
};

// --- Detail ----------------------------------------------------------------

export type ExerciseSummary = {
  id: string;
  code: string;
  name: string;
  tracked_joints?: TrackedJoint[];
  target_finger?: string;
};

export type PrescriptionRow = {
  id: string;
  patient_id: string;
  exercise_id: string;
  sets: number;
  reps_per_set: number;
  sessions_per_day: number;
  duration_days: number;
  starts_on: string;
  replaces_id: string | null;
  created_at: string;
  exercise: ExerciseSummary | null;
};

export type SessionRow = {
  id: string;
  prescription_id: string;
  started_at: string;
  ended_at: string | null;
  reps_completed: number;
  target_reps: number;
  completion_pct: number;
  prescription: { id: string; exercise: ExerciseSummary | null } | null;
};

export type AdherenceRow = {
  completed_sessions: number;
  expected_sessions: number;
  adherence_pct: number;
};

export type PatientDetail = {
  id: string;
  external_id: string;
  pathology_code: PathologyCode | null;
  access_token: string;
  started_at: string;
  discharged_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PatientDetailResponse = {
  patient: PatientDetail;
  prescriptions: PrescriptionRow[];
  sessions: SessionRow[];
  adherence: AdherenceRow | null;
};

// --- Internals -------------------------------------------------------------

async function originAndCookies(): Promise<{ url: string; cookieHeader: string }> {
  const h = await headers();
  const c = await cookies();
  const host = h.get('host') ?? 'localhost:3500';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const cookieHeader = c
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');
  return { url: `${proto}://${host}`, cookieHeader };
}

async function doctorFetch<T>(path: string): Promise<{ data: T | null; status: number }> {
  const { url, cookieHeader } = await originAndCookies();
  const res = await fetch(`${url}${path}`, {
    cache: 'no-store',
    headers: { cookie: cookieHeader },
  });
  if (!res.ok) return { data: null, status: res.status };
  const data = (await res.json()) as T;
  return { data, status: res.status };
}

export async function fetchPatients(params: {
  search?: string;
  status?: StatusFilter;
}): Promise<{ data: PatientListResponse | null; status: number }> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.status && params.status !== 'all') qs.set('status', params.status);
  const suffix = qs.toString();
  return doctorFetch<PatientListResponse>(`/api/doctor/patients${suffix ? `?${suffix}` : ''}`);
}

export async function fetchPatientDetail(
  id: string,
): Promise<{ data: PatientDetailResponse | null; status: number }> {
  return doctorFetch<PatientDetailResponse>(`/api/doctor/patients/${encodeURIComponent(id)}`);
}

/**
 * The exercises catalog is small (2 rows in Fase 1) and readable by any
 * authenticated user. We hit Supabase directly from the server component to
 * avoid creating a new HTTP route just for this.
 */
export async function fetchExercisesCatalog(): Promise<ExerciseSummary[]> {
  const { createSupabaseServerClient } = await import('./supabase/server');
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('exercises')
    .select('id, code, name, tracked_joints, target_finger')
    .order('code');
  return (data ?? []) as ExerciseSummary[];
}

/**
 * Build the public patient URL from the access_token. Uses request headers so
 * it works behind a proxy in production and on localhost in dev.
 */
export async function buildPatientAccessUrl(accessToken: string): Promise<string> {
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3500';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}/p/${accessToken}`;
}
