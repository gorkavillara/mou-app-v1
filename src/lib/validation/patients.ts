import { z } from 'zod';

/**
 * Body schema for POST /api/doctor/patients (B-06).
 *
 * D3 (anonymous patients): no name/email/phone/dob ever. We use `.strict()`
 * so that any extra field — including PII fields someone might add by accident —
 * causes a validation error. Defense in depth: the DB also lacks those columns.
 */
export const createPatientSchema = z
  .object({
    external_id: z
      .string()
      .min(1, { error: 'external_id required' })
      .max(64, { error: 'external_id too long' }),
    pathology_code: z.enum(['flexor', 'extensor', 'otros']).optional(),
  })
  .strict();

export type CreatePatientInput = z.infer<typeof createPatientSchema>;

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
    duration_days: z.number().int().positive(),
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
