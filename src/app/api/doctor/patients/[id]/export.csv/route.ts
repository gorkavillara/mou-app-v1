import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { errorResponse } from '@/lib/api/errors';

/**
 * B-19 — GET /api/doctor/patients/:id/export.csv
 *
 * Returns a single CSV with one row per `rep_measurement`. The doctor uses
 * this to take raw data into a meeting with the mutua.
 *
 * Auth: middleware gates `/api/doctor/*`. Inside, we fetch the patient row
 * first to (a) confirm it exists for this doctor (RLS → 404 otherwise) and
 * (b) obtain `external_id` for the filename.
 *
 * Volume: hard-cap 50,000 rows (more than 1 year of pilot data per patient).
 * Above that → 413 `too_many_rows`. We could stream, but a single in-memory
 * build keeps the route trivial and well below memory limits at this volume.
 *
 * Format: RFC 4180. UTF-8 BOM for Excel friendliness. We escape every field
 * defensively (even ones that shouldn't contain quotes per the external_id
 * regex) so a future schema change can't introduce CSV injection.
 *
 * `force-dynamic` because the result is per-doctor and time-sensitive.
 */
export const dynamic = 'force-dynamic';

const ROW_CAP = 50_000;

const HEADERS = [
  'patient_external_id',
  'session_id',
  'session_started_at',
  'session_ended_at',
  'exercise_code',
  'prescription_id',
  'sets',
  'reps_per_set',
  'sessions_per_day',
  'rep_index',
  'joint',
  'max_flexion_deg',
  'max_extension_deg',
  'quality_flag',
] as const;

type SessionRow = {
  id: string;
  started_at: string | null;
  ended_at: string | null;
  prescription_id: string;
  prescription: {
    id: string;
    sets: number;
    reps_per_set: number;
    sessions_per_day: number;
    exercise: { code: string } | null;
  } | null;
  rep_measurements: Array<{
    rep_index: number;
    joint: string;
    max_flexion_deg: number | null;
    max_extension_deg: number | null;
    quality_flag: string | null;
  }>;
};

/**
 * RFC 4180 escape: quote the field iff it contains `,`, `"`, CR or LF, and
 * double any embedded `"`. Always safe to call on plain values.
 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: patientId } = await context.params;

  const supabase = await createSupabaseServerClient();

  // 404 short-circuit + filename source.
  const { data: patient, error: patientErr } = await supabase
    .from('patients')
    .select('id, external_id')
    .eq('id', patientId)
    .maybeSingle();

  if (patientErr) return errorResponse('db_error', 500, patientErr.message);
  if (!patient) return errorResponse('not_found', 404);

  // Pull sessions + nested prescription + exercise + measurements in one
  // round-trip. RLS on `sessions` and `rep_measurements` already filters by
  // doctor; we still constrain by patient_id explicitly for clarity.
  const { data: sessions, error: sessionsErr } = await supabase
    .from('sessions')
    .select(
      `id,
       started_at,
       ended_at,
       prescription_id,
       prescription:prescriptions(id, sets, reps_per_set, sessions_per_day, exercise:exercises(code)),
       rep_measurements(rep_index, joint, max_flexion_deg, max_extension_deg, quality_flag)`,
    )
    .eq('patient_id', patientId)
    .order('started_at', { ascending: true });

  if (sessionsErr) return errorResponse('db_error', 500, sessionsErr.message);

  // Flatten to one row per rep_measurement, sorted by (started_at, rep_index,
  // joint). The outer order is already started_at asc; we sort the inner
  // measurements per session.
  const lines: string[] = [];
  lines.push(HEADERS.map(csvEscape).join(','));

  let total = 0;
  for (const session of (sessions ?? []) as unknown as SessionRow[]) {
    const measurements = [...(session.rep_measurements ?? [])].sort((a, b) => {
      if (a.rep_index !== b.rep_index) return a.rep_index - b.rep_index;
      return a.joint.localeCompare(b.joint);
    });

    for (const m of measurements) {
      total += 1;
      if (total > ROW_CAP) {
        return errorResponse('too_many_rows', 413, undefined, {
          limit: ROW_CAP,
        });
      }
      const row = [
        patient.external_id,
        session.id,
        session.started_at,
        session.ended_at,
        session.prescription?.exercise?.code ?? null,
        session.prescription_id,
        session.prescription?.sets ?? null,
        session.prescription?.reps_per_set ?? null,
        session.prescription?.sessions_per_day ?? null,
        m.rep_index,
        m.joint,
        m.max_flexion_deg,
        m.max_extension_deg,
        m.quality_flag,
      ];
      lines.push(row.map(csvEscape).join(','));
    }
  }

  // \r\n line endings per RFC 4180. UTF-8 BOM (﻿) so Excel autodetects
  // the encoding.
  const body = '﻿' + lines.join('\r\n') + '\r\n';

  const filename = `mou-${patient.external_id}-${ymd(new Date())}.csv`;

  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'private, no-store',
    },
  });
}
