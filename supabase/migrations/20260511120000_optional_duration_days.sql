-- =============================================================================
-- Bugfix (manual testing 2026-05-11): `duration_days` must be optional.
--
-- The pilot doctor wants to prescribe open-ended treatments and only close
-- them manually via /discharge (D5+D6 — treatment ends when the doctor
-- decides, not by an arbitrary timer). Today the column is `NOT NULL`, which
-- forces the UI to invent a value at creation time.
--
-- NULL semantics:
--   - `duration_days IS NULL` => prescription is active indefinitely
--     (until the patient is discharged or a newer prescription replaces it).
--   - The original column-level check `duration_days > 0` is satisfied
--     trivially when the value is NULL (CHECK constraints evaluate to TRUE
--     for NULL by SQL spec), so no further DDL is needed for the check.
--
-- Existing rows keep their non-null values — no data migration needed.
-- =============================================================================

alter table public.prescriptions
  alter column duration_days drop not null;

comment on column public.prescriptions.duration_days is
  'Duración en días. NULL = tratamiento abierto (termina sólo al discharge).';
