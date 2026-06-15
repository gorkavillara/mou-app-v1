import { z } from 'zod';

/**
 * FB-1 (2026-06-06): a single finger name. Values match the `FingerName` type
 * in src/lib/hand-tracking.ts EXACTLY (Spanish, identical strings) and the DB
 * CHECK constraints in 20260606120000_finger_status_arrays.sql.
 */
export const fingerNameSchema = z.enum([
  'pulgar',
  'indice',
  'medio',
  'anular',
  'menique',
]);

export type FingerName = z.infer<typeof fingerNameSchema>;

/**
 * FB-1 (2026-06-06): an array of distinct finger names (max 5, no duplicates).
 * Used for both `injured_fingers` and `amputated_fingers`. Cross-array overlap
 * is validated by `.refine` on the parent schemas (and by the DB constraint
 * `fingers_no_overlap` as a backstop).
 */
const fingerArraySchema = z
  .array(fingerNameSchema)
  .max(5, { error: 'at most 5 fingers' })
  .refine((arr) => new Set(arr).size === arr.length, {
    error: 'finger values must be unique',
  });

/**
 * D14 (FB-3): the doctor MUST mark at least one injured finger — the injured
 * set drives the goniometer (the camera measures the MCP of each injured
 * finger). Same uniqueness/cap rules as `fingerArraySchema` but non-empty.
 */
const injuredFingersSchema = z
  .array(fingerNameSchema)
  .min(1, { error: 'at least one injured finger is required' })
  .max(5, { error: 'at most 5 fingers' })
  .refine((arr) => new Set(arr).size === arr.length, {
    error: 'finger values must be unique',
  });

/** FB-1: the two arrays must not share any finger. */
function noOverlap(
  body: { injured_fingers?: FingerName[]; amputated_fingers?: FingerName[] },
): boolean {
  const injured = body.injured_fingers ?? [];
  const amputated = body.amputated_fingers ?? [];
  if (injured.length === 0 || amputated.length === 0) return true;
  const injuredSet = new Set(injured);
  return !amputated.some((f) => injuredSet.has(f));
}

/**
 * UX-5 (2026-05-20): a strict YYYY-MM-DD date that must also be a real calendar
 * date (rejects '2026-13-40'). The progression query uses a regex-only `isoDate`
 * below (range-checked at the route), but for the surgery_date we additionally
 * validate the calendar so an impossible date never reaches Postgres as a 500.
 */
const isoCalendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'must be YYYY-MM-DD' })
  .refine(
    (s) => {
      const [y, m, d] = s.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      return (
        dt.getUTCFullYear() === y &&
        dt.getUTCMonth() === m - 1 &&
        dt.getUTCDate() === d
      );
    },
    { error: 'must be a valid calendar date' },
  );

/**
 * UX-5: free-text surgical descriptor (e.g. "Tenorrafia FDP 5º dedo"). Trimmed,
 * 1..120 chars. Empty string is NOT accepted (omit the field instead). D3: the
 * UI instructs the surgeon not to write names; the 120-char bound keeps it to
 * jargon and the patient-token API never exposes it.
 */
const surgeryNoteSchema = z
  .string()
  .trim()
  .min(1, { error: 'surgery_note must not be empty' })
  .max(120, { error: 'surgery_note too long (max 120)' });

/**
 * UX-6 (2026-05-20): the surgeon tried "PRUEBA 1" and it was rejected. We allow
 * single spaces BETWEEN words (no leading/trailing spaces, no double spaces).
 * Allowed token chars stay conservative: letters, digits, `_`, `-`, `/`.
 */
const externalIdSchema = z
  .string()
  .min(1, { error: 'external_id required' })
  .max(64, { error: 'external_id too long' })
  .regex(/^[A-Za-z0-9_\-/]+( [A-Za-z0-9_\-/]+)*$/, {
    error:
      'external_id may contain letters, digits, _ - / and single spaces between words',
  });

/**
 * Body schema for POST /api/doctor/patients (B-06).
 *
 * D3 (anonymous patients): no name/email/phone/dob ever. We use `.strict()`
 * so that any extra field — including PII fields someone might add by accident —
 * causes a validation error. Defense in depth: the DB also lacks those columns.
 *
 * D14 (FB-3): `injured_fingers` is now REQUIRED and non-empty (>= 1) — the
 * doctor must declare which finger(s) are affected because the injured set is
 * what the goniometer measures. `amputated_fingers` is deprecated/unused (the
 * picker is N/L only) but the column and schema field stay for back-compat;
 * when present it must still not overlap the injured set. The legacy singular
 * `injured_finger` is REMOVED — `.strict()` rejects it.
 *
 * UX-5: `surgery_date` (valid calendar YYYY-MM-DD) and `surgery_note` (trimmed
 * 1..120 chars) are optional on create. Omit rather than send null; clearing
 * happens via PATCH.
 */
export const createPatientSchema = z
  .object({
    external_id: externalIdSchema,
    pathology_code: z.enum(['flexor', 'extensor', 'otros']).optional(),
    injured_fingers: injuredFingersSchema,
    amputated_fingers: fingerArraySchema.optional(),
    surgery_date: isoCalendarDate.optional(),
    surgery_note: surgeryNoteSchema.optional(),
  })
  .strict()
  .refine(noOverlap, {
    error: 'a finger cannot be both injured and amputated',
    path: ['amputated_fingers'],
  });

export type CreatePatientInput = z.infer<typeof createPatientSchema>;

/**
 * Body schema for PATCH /api/doctor/patients/:id (FB-1 + UX-5).
 *
 * The body may carry any NON-EMPTY subset of the clinical-record fields:
 *   - `injured_fingers`:   FingerName[] (FULL REPLACEMENT; D14: must be >= 1
 *                          when present — clearing to `[]` is NOT allowed)
 *   - `amputated_fingers`: FingerName[] (FULL REPLACEMENT; send `[]` to clear)
 *   - `surgery_date`:      YYYY-MM-DD | null (UX-5; null clears)
 *   - `surgery_note`:      1..120 chars | null (UX-5; null clears)
 *
 * Every field is `.optional()` so partial updates work, but `.refine` rejects
 * `{}` (at least one key required) — a no-op PATCH is a client mistake (400).
 * `.strict()` still rejects any other field, including the legacy
 * `injured_finger` and any PII (D3).
 *
 * Cross-field no-overlap is enforced here ONLY when BOTH arrays are present in
 * the same request. When only ONE array is sent, the route must validate it
 * against the OTHER array's CURRENT DB value before writing (read-modify-validate).
 */
export const patchPatientSchema = z
  .object({
    injured_fingers: injuredFingersSchema.optional(),
    amputated_fingers: fingerArraySchema.optional(),
    surgery_date: isoCalendarDate.nullable().optional(),
    surgery_note: surgeryNoteSchema.nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    error: 'at least one field is required',
  })
  .refine(
    (body) =>
      // Only enforce here when BOTH arrays are present; the single-array case
      // is validated against the DB in the route.
      !(body.injured_fingers && body.amputated_fingers) || noOverlap(body),
    {
      error: 'a finger cannot be both injured and amputated',
      path: ['amputated_fingers'],
    },
  );

export type PatchPatientInput = z.infer<typeof patchPatientSchema>;

/**
 * Query schema for GET /api/doctor/patients (B-07).
 */
export const listPatientsQuerySchema = z.object({
  search: z.string().trim().max(64).optional(),
  status: z.enum(['active', 'discharged', 'all']).default('all'),
});

export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;

/**
 * Body schema for POST /api/doctor/patients/:id/prescriptions (B-09).
 */
export const createPrescriptionSchema = z
  .object({
    exercise_id: z.uuid({ error: 'exercise_id must be a UUID' }),
    sets: z.number().int().positive(),
    reps_per_set: z.number().int().positive(),
    sessions_per_day: z.number().int().positive(),
    // duration_days is optional: NULL/omitted = open-ended treatment that
    // only ends when the doctor calls /discharge (manual-testing 2026-05-11).
    duration_days: z.number().int().positive().optional(),
    starts_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'starts_on must be YYYY-MM-DD' })
      .optional(),
  })
  .strict();

export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;

/**
 * Path param schema for patient-facing routes (B-11, B-12).
 *
 * `access_token` defaults to base64(gen_random_bytes(24)) which is 32 chars,
 * but we accept 20..64 to give headroom for legacy/future tokens. Anything
 * outside that range we treat as `not_found` to avoid leaking format details.
 */
export const patientTokenSchema = z.string().min(20).max(64);

/**
 * Body schema for POST /api/patient/:token/sessions (B-12).
 *
 * `.strict()` rejects any unknown field — defense in depth against PII slipping
 * in from a malicious client (D3 anonymity).
 */
export const createSessionSchema = z
  .object({
    prescription_id: z.uuid(),
    started_at: z.iso.datetime(),
    ended_at: z.iso.datetime(),
    reps_completed: z.number().int().min(0),
    target_reps: z.number().int().positive(),
    rep_measurements: z
      .array(
        z
          .object({
            rep_index: z.number().int().nonnegative(),
            joint: z.string().min(1).max(16),
            // D14 (FB-3): the affected finger this measurement belongs to.
            // Optional/nullable for resilience (e.g. wrist-only or legacy
            // clients); the camera always sends it for finger joints. The
            // route maps a missing value to NULL.
            finger: fingerNameSchema.nullable().optional(),
            max_flexion_deg: z.number().nullable().optional(),
            max_extension_deg: z.number().nullable().optional(),
            quality_flag: z
              .enum(['clean', 'low_visibility', 'low_confidence', 'partial'])
              .optional(),
          })
          .strict(),
      )
      .max(2000),
    client_metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

/**
 * Query schema for GET /api/doctor/patients/:id/progression (B-14).
 *
 * - `from` / `to`: optional ISO date (YYYY-MM-DD); the route fills defaults
 *   (patient.started_at and current_date) when missing.
 * - `joint`: optional, can be repeated (URLSearchParams.getAll). Each value
 *   must be a known joint label per the angular convention vault doc.
 */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'must be YYYY-MM-DD' });

export const progressionQuerySchema = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    // Up to 32 joints — well above the 13 we currently track (wrist + 4 per
    // finger × 3 joints = 12). Bound prevents pathological URLs.
    joint: z.array(z.string().min(1).max(24)).max(32).optional(),
  })
  .refine(
    (q) => !q.from || !q.to || q.from <= q.to,
    { error: 'from must be <= to', path: ['from'] },
  );

export type ProgressionQuery = z.infer<typeof progressionQuerySchema>;

/**
 * Query schema for GET /api/doctor/alerts (B-18).
 *
 * `threshold_hours` defaults to 48 (2 days, the value the panel will use by
 * default). Bound at [1, 720] (30 days) to keep the function cheap and avoid
 * pathological inputs.
 */
export const alertsQuerySchema = z.object({
  threshold_hours: z.coerce
    .number()
    .int()
    .min(1, { error: 'threshold_hours must be >= 1' })
    .max(720, { error: 'threshold_hours must be <= 720' })
    .default(48),
});

export type AlertsQuery = z.infer<typeof alertsQuerySchema>;
