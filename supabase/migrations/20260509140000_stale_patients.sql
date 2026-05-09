-- =============================================================================
-- B-18 — Pacientes "stale" (alertas por inactividad)
--
-- Devuelve, para un doctor concreto, los pacientes activos cuyo último
-- `sessions.started_at` es anterior a `p_threshold_hours` horas, o que no
-- tienen ninguna sesión todavía.
--
-- "Activo" = `discharged_at IS NULL` AND existe al menos una prescription
-- vigente hoy (mismo criterio que B-11):
--   `pr.starts_on <= current_date < pr.starts_on + duration_days`.
--
-- security definer: la API ya valida `auth.uid()` y pasa p_doctor_id explícito;
-- la función filtra por índice (patients.doctor_id) sin depender de RLS dentro
-- del cuerpo (que aquí estaría implícito por el caller, pero queremos que el
-- plan use el índice de doctor_id directamente).
-- =============================================================================

create or replace function public.stale_patients(
  p_doctor_id uuid,
  p_threshold_hours int
)
returns table (
  patient_id uuid,
  external_id text,
  pathology_code text,
  last_session_at timestamptz,
  hours_since_last numeric,
  has_ever_session boolean
) language sql stable security definer set search_path = public as $$
  with active_patients as (
    select p.id, p.external_id, p.pathology_code
    from public.patients p
    where p.doctor_id = p_doctor_id
      and p.discharged_at is null
      and exists (
        select 1 from public.prescriptions pr
        where pr.patient_id = p.id
          and pr.starts_on <= current_date
          and pr.starts_on + (pr.duration_days || ' days')::interval > current_date
      )
  ),
  last_sessions as (
    select patient_id, max(started_at) as last_session_at
    from public.sessions
    group by patient_id
  )
  select ap.id as patient_id,
         ap.external_id,
         ap.pathology_code,
         ls.last_session_at,
         extract(epoch from (now() - coalesce(ls.last_session_at, '1970-01-01'::timestamptz))) / 3600.0 as hours_since_last,
         ls.last_session_at is not null as has_ever_session
  from active_patients ap
  left join last_sessions ls on ls.patient_id = ap.id
  where ls.last_session_at is null or now() - ls.last_session_at > (p_threshold_hours || ' hours')::interval;
$$;

comment on function public.stale_patients(uuid, int) is
  'B-18: pacientes activos del doctor cuya última sesión supera p_threshold_hours, o que nunca han iniciado sesión.';
