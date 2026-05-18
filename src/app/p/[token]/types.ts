/**
 * Shared types for the patient-side flow (F-08, F-09, F-10).
 * Mirror the response shapes returned by:
 *   - GET  /api/patient/[token]            (B-11)
 *   - POST /api/patient/[token]/sessions   (B-12)
 *
 * Kept narrow on purpose: the patient UI only needs what's listed here.
 */

import type {
  PathologyCode,
  QualityFlag,
  TargetFinger,
  TrackedJoint,
} from '@/lib/database.types';

export type PatientPublic = {
  id: string;
  external_id: string;
  pathology_code: PathologyCode | null;
  started_at: string;
  discharged_at: string | null;
};

export type ExercisePublic = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  animation_url: string | null;
  tracked_joints: TrackedJoint[];
  target_finger: TargetFinger;
};

export type PrescriptionPublic = {
  id: string;
  exercise_id: string;
  sets: number;
  reps_per_set: number;
  sessions_per_day: number;
  // NULL = tratamiento abierto (acaba con discharge).
  duration_days: number | null;
  starts_on: string;
  // NULL si la prescripción es abierta (no tiene fecha de cierre).
  ends_on: string | null;
  exercise: ExercisePublic | null;
};

export type PatientHomePayload = {
  patient: PatientPublic;
  prescriptions: PrescriptionPublic[];
  today: {
    sessions_completed: number;
    sessions_target: number;
  };
};

export type RepMeasurementPayload = {
  rep_index: number;
  joint: TrackedJoint;
  max_flexion_deg: number | null;
  max_extension_deg: number | null;
  quality_flag?: QualityFlag;
};

export type CreateSessionPayload = {
  prescription_id: string;
  started_at: string;
  ended_at: string;
  reps_completed: number;
  target_reps: number;
  rep_measurements: RepMeasurementPayload[];
  client_metadata?: {
    user_agent: string;
    viewport: { w: number; h: number };
    device_pixel_ratio: number;
  };
};
