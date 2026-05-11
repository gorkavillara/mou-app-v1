-- =============================================================================
-- Bugfix (2026-05-11): `stale_patients` must consider open-ended prescriptions
-- (`duration_days IS NULL`) as ACTIVE.
--
-- Previously the active check was:
--   pr.starts_on + (pr.duration_days || ' days')::interval > current_date
--
-- With NULL duration_days, the `||` concatenation yields NULL, the interval
-- cast yields NULL, the comparison yields NULL → the row is filtered out
-- silently. Open-ended treatments would never show up in the alerts panel,
-- which is exactly the opposite of what we want.
--
-- New rule: active if discharged_at IS NULL AND there exists at least one
-- prescription whose started window covers today, where "covers today" is
-- true either because duration_days is NULL (open-ended) or because
-- starts_on + duration_days > current_date.
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
          and (
            -- Open-ended: never expires by time.
            pr.duration_days is null
            or pr.starts_on + (pr.duration_days || ' days')::interval > current_date
          )
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
  'B-18: pacientes activos del doctor cuya última sesión supera p_threshold_hours, o que nunca han iniciado sesión. Considera prescriptions con duration_days NULL como abiertas (siempre activas).';
