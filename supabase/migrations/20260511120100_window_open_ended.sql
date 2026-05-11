-- =============================================================================
-- Bugfix (2026-05-11): `patient_adherence_window` must handle open-ended
-- prescriptions (`duration_days IS NULL`).
--
-- Math: for each prescription we count expected sessions as
--   sessions_per_day * days_active_in_window
-- where days_active is the intersection of:
--   - prescription active period: [starts_on, starts_on + duration_days)
--   - reporting window:            [today - (N - 1), today]
--
-- For NULL `duration_days` the active period has no end → it never trims the
-- window. Practical implementation: substitute NULL with a sentinel of 99999
-- days (~273 years), which is large enough to never be the binding limit for
-- any realistic N (we use 7 today, max 720 hours of staleness elsewhere) yet
-- preserves the LEAST() semantics used previously. Avoids special-casing the
-- expression and keeps the SQL planner-friendly.
--
-- Also fix the base view `patient_adherence` which used the same math and was
-- not touched in 2026-05-09 (it feeds the `total` column of the breakdown).
-- We drop + recreate it because Postgres won't let us alter the column list,
-- and the breakdown view depends on it — so the breakdown view is recreated
-- afterwards as well.
-- =============================================================================

-- Recreate the windowed function with NULL-safe math.
create or replace function public.patient_adherence_window(window_days int)
returns table (
  patient_id uuid,
  sessions_completed int,
  sessions_target int,
  adherence_pct numeric
) language sql security definer set search_path = public as $$
  with windowed as (
    select p.id as patient_id, p.doctor_id,
      sum(pr.sessions_per_day * least(
        -- 99999d sentinel: prescriptions with NULL duration_days are
        -- treated as effectively infinite, so the window length wins.
        coalesce(pr.duration_days, 99999),
        greatest(0, (current_date - greatest(pr.starts_on, current_date - (window_days - 1)))::int + 1)
      )) as expected
    from public.patients p
    join public.prescriptions pr on pr.patient_id = p.id
    where p.discharged_at is null
    group by p.id, p.doctor_id
  ),
  done as (
    select patient_id, count(*)::int as completed
    from public.sessions
    where ended_at is not null
      and started_at >= (current_date - (window_days - 1))::timestamptz
    group by patient_id
  )
  select w.patient_id,
         coalesce(d.completed, 0) as sessions_completed,
         coalesce(w.expected, 0)::int as sessions_target,
         case when coalesce(w.expected, 0) = 0 then 0
              else round((coalesce(d.completed, 0)::numeric / w.expected::numeric) * 100, 2)
         end as adherence_pct
  from windowed w left join done d using (patient_id);
$$;

comment on function public.patient_adherence_window(int) is
  'Adherencia en una ventana móvil de N días. Open-ended (duration_days NULL) cuenta como infinita en la intersección con la ventana.';

-- Recreate the base view (drop + recreate because Postgres won't alter
-- view column-list semantics in-place; the breakdown view depends on it).
drop view if exists public.patient_adherence_breakdown;
drop view if exists public.patient_adherence;

create view public.patient_adherence as
with prescription_targets as (
  select
    p.id as patient_id,
    p.doctor_id,
    sum(pr.sessions_per_day * least(
        -- Same 99999d sentinel: open-ended prescriptions never trim the
        -- "since started_at" interval; the date window wins.
        coalesce(pr.duration_days, 99999),
        greatest(0, (current_date - greatest(pr.starts_on, p.started_at))::int + 1)
    )) as expected_sessions
  from public.patients p
  join public.prescriptions pr on pr.patient_id = p.id
  where p.discharged_at is null
  group by p.id, p.doctor_id
),
actual as (
  select patient_id, count(*)::int as completed_sessions
  from public.sessions
  where ended_at is not null
  group by patient_id
)
select
  pt.patient_id,
  pt.doctor_id,
  coalesce(a.completed_sessions, 0) as completed_sessions,
  pt.expected_sessions::int as expected_sessions,
  case when pt.expected_sessions = 0 then 0
       else round((coalesce(a.completed_sessions, 0)::numeric / pt.expected_sessions::numeric) * 100, 2)
  end as adherence_pct
from prescription_targets pt
left join actual a on a.patient_id = pt.patient_id;

comment on view public.patient_adherence is
  'Adherencia: sesiones completadas vs prescritas hasta hoy. NULL duration_days = abierto.';

create view public.patient_adherence_breakdown as
  select pa.patient_id,
         pa.doctor_id,
         pa.completed_sessions as total_completed,
         pa.expected_sessions  as total_target,
         pa.adherence_pct      as total_pct,
         w7.sessions_completed as week_completed,
         w7.sessions_target    as week_target,
         w7.adherence_pct      as week_pct
    from public.patient_adherence pa
    left join public.patient_adherence_window(7) w7 on w7.patient_id = pa.patient_id;

comment on view public.patient_adherence_breakdown is
  'Adherencia por paciente: total (desde alta) + últimos 7 días.';
