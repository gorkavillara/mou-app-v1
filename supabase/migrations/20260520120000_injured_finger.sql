-- UX-4 (2026-05-20): the doctor records which finger was operated so the
-- exercise session can (a) paint it distinctly and (b) drive the angle
-- measurement from THAT finger instead of the all-fingers average.
alter table public.patients
  add column injured_finger text
  check (injured_finger in ('pulgar','indice','medio','anular','menique'));

comment on column public.patients.injured_finger is
  'Dedo operado/lesionado (UX-4). NULL = no especificado → la sesión mide la media de todos los dedos (comportamiento actual). Valores idénticos al tipo FingerName de src/lib/hand-tracking.ts.';
