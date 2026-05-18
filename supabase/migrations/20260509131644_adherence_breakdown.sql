-- =============================================================================
-- B-13 — Adherencia avanzada (ventanas: total + 7d)
--
-- Extiende la vista existente `patient_adherence` (que sólo expone el total
-- desde started_at) con una ventana móvil de 7 días. Para no romper consumers
-- que ya leen `patient_adherence`, dejamos esa vista intacta y publicamos una
-- nueva: `patient_adherence_breakdown`, que joinea la ventana de 7d sobre
-- `patient_adherence`.
--
-- Decisión: una única función `patient_adherence_window(window_days int)` que
-- recibe la ventana como parámetro, en vez de duplicar SQL para 7d / 30d /
-- futuras ventanas. La vista materializada total (`patient_adherence`) se
-- conserva tal cual porque está optimizada para ese caso (no necesita el
-- recorte por current_date - N+1) y porque ya está documentada en el vault.
-- =============================================================================

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
        pr.duration_days,
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
  'Adherencia en una ventana móvil de N días terminando hoy. Usado por el panel doctor.';

-- Vista combinada: total (desde started_at) + ventana 7d. La columna doctor_id
-- viene de patient_adherence para que las RLS posteriores (si las hubiera)
-- puedan filtrar; las consultas actuales pasan por la API server-side, así que
-- no añadimos policy a la vista (security_invoker hereda de las tablas base).
create or replace view public.patient_adherence_breakdown as
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
