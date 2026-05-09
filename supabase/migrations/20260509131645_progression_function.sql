-- =============================================================================
-- B-14 — Progresión angular por paciente (función SQL)
--
-- Esta función agrega `rep_measurements` a granularidad (día, articulación)
-- para alimentar el gráfico de evolución del panel doctor.
--
-- Decisión: función en vez de vista porque necesitamos parametrizar por
-- patient_id + ventana fechas. Una vista global agregaría todos los pacientes
-- y la API tendría que filtrar después; con función filtramos en el plan
-- de ejecución y aprovechamos el índice (session_id) y el join con sessions
-- (patient_id).
--
-- Cálculo:
--   * max(max_flexion_deg)  excluyendo reps con quality_flag in (low_*)
--   * min(max_extension_deg) excluyendo idem (la extensión es negativa, su
--     "máxima" es el mínimo numérico)
--   * count(*) sobre TODAS las reps (incluye las flagged) para que la UI
--     pueda mostrar densidad de muestreo.
--
-- security definer: la API ya valida que el paciente pertenece al doctor
-- llamante (404 explícito) antes de invocar la función. Necesitamos definer
-- para que la función vea las tablas con search_path estable, no por bypass
-- de RLS (la API es la que autoriza).
-- =============================================================================

create or replace function public.patient_progression(
  p_patient_id uuid,
  p_from date,
  p_to date,
  p_joints text[] default null
)
returns table (
  day date,
  joint text,
  max_flexion numeric,
  max_extension numeric,
  samples int
) language sql stable security definer set search_path = public as $$
  select
    (rm.recorded_at at time zone 'UTC')::date as day,
    rm.joint,
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
  group by 1, 2
  order by 1 asc, 2 asc;
$$;

comment on function public.patient_progression(uuid, date, date, text[]) is
  'Serie temporal por (día, articulación) de máxima flexión/extensión y nº muestras. Excluye low_visibility / low_confidence del max/min, las cuenta en samples.';
