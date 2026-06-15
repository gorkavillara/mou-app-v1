-- FB-3 / D14 (2026-06-15): per-finger granularity on measurements.
-- A measurement is now identified by rep × joint × finger. The injured set can
-- contain several fingers, and the goniometer measures the MCP of each one, so
-- we need to know which finger a given rep_measurement belongs to.
alter table public.rep_measurements
  add column finger text null;

-- Valid values: NULL (legacy rows aggregated across fingers, recorded before
-- this column existed) or one of the 5 Spanish finger names. Same value set
-- and constraint style as 20260606120000_finger_status_arrays.sql.
alter table public.rep_measurements
  add constraint rep_measurements_finger_valid
    check (finger is null
           or finger = any (array['pulgar','indice','medio','anular','menique']));

comment on column public.rep_measurements.finger is
  'FB-3 / D14 (2026-06-15): dedo afectado de esta medición (granularidad rep×articulación×dedo). Valores idénticos al tipo FingerName de src/lib/hand-tracking.ts. NULL = filas legacy agregadas (registradas antes de existir la columna). Los antiguos "amputados" pasan a tratarse como lesionados (FB-3/D14), así que toda fila nueva lleva un dedo concreto.';
