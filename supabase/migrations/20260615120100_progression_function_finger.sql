-- =============================================================================
-- FB-3 / D14 (2026-06-15) — progresión angular POR DEDO
--
-- Reemplaza public.patient_progression (versión B-14 en
-- 20260509131645_progression_function.sql) para agrupar también por
-- rep_measurements.finger (añadido en 20260615120000_rep_measurements_finger.sql,
-- que DEBE aplicarse antes).
--
-- Cambios respecto a la versión B-14:
--   * SELECT y GROUP BY incluyen rm.finger (group by día, joint, finger).
--   * returns table añade `finger text` entre `joint` y `max_flexion`, para
--     casar el orden del tipo TS congelado (database.types.ts Returns).
--   * Retrocompatibilidad: las filas legacy con finger NULL se agrupan juntas
--     (un grupo por (día, joint, NULL)) — group by trata NULL como un grupo.
--
-- Todo lo demás (filtros quality_flag, security definer, search_path, samples
-- contando TODAS las reps) es idéntico a la versión anterior.
--
-- NOTA: añadir una columna al RETURNS TABLE cambia el tipo de retorno, así que
-- `create or replace` no basta (Postgres: "cannot change return type"). Hay que
-- DROP la firma anterior primero.
-- =============================================================================

drop function if exists public.patient_progression(uuid, date, date, text[]);

create or replace function public.patient_progression(
  p_patient_id uuid,
  p_from date,
  p_to date,
  p_joints text[] default null
)
returns table (
  day date,
  joint text,
  finger text,
  max_flexion numeric,
  max_extension numeric,
  samples int
) language sql stable security definer set search_path = public as $$
  select
    (rm.recorded_at at time zone 'UTC')::date as day,
    rm.joint,
    rm.finger,
    max(rm.max_flexion_deg)
      filter (where rm.quality_flag is null
                 or rm.quality_flag not in ('low_visibility','low_confidence'))
      as max_flexion,
    min(rm.max_extension_deg)
      filter (where rm.quality_flag is null
                 or rm.quality_flag not in ('low_visibility','low_confidence'))
      as max_extension,
    count(*)::int as samples
  from public.rep_measurements rm
  join public.sessions s on s.id = rm.session_id
  where s.patient_id = p_patient_id
    and (rm.recorded_at at time zone 'UTC')::date between p_from and p_to
    and (p_joints is null or rm.joint = any(p_joints))
  group by 1, 2, 3
  order by 1 asc, 2 asc, 3 asc;
$$;

comment on function public.patient_progression(uuid, date, date, text[]) is
  'FB-3/D14: serie temporal por (día, articulación, dedo) de máxima flexión/extensión y nº muestras. Excluye low_visibility / low_confidence del max/min, las cuenta en samples. finger NULL = filas legacy agregadas.';
