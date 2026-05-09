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
