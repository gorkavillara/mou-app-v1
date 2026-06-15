-- =============================================================================
-- D14 (FB-3) — los "amputados" se tratan como lesionados (se miden)
--
-- En FB-3 el picker del panel pasó a N/L (se retiró Amputado) y la columna
-- `amputated_fingers` quedó DEPRECADA/sin uso desde el UI. Pero los datos
-- preexistentes (pacientes creados en FB-1 con dedos amputados) seguían en BD:
--   - la cámara los EXCLUÍA de la medición (driverFingerNames filtra amputados),
--   - el panel ya no los muestra ni los puede limpiar,
--   - y editar el paciente podía disparar 400 fingers_overlap.
--
-- Decisión D14: tratar los amputados como lesionados. Esta migración hace el
-- backfill de una vez: injured = unión(injured, amputated) sin duplicados, y
-- vacía amputated. Con amputated = '{}' la constraint fingers_no_overlap queda
-- trivialmente satisfecha. Idempotente (solo toca filas con amputados).
-- =============================================================================
update public.patients
set
  injured_fingers = (
    select coalesce(array_agg(distinct f order by f), '{}')
    from unnest(injured_fingers || amputated_fingers) as f
  ),
  amputated_fingers = '{}'
where cardinality(amputated_fingers) > 0;
