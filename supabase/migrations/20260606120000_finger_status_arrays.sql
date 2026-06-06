-- FB-1 (2026-06-06): a hand can have several affected fingers, and
-- injured (measured, orange) vs amputated (excluded, dashed gray) are
-- clinically different. Replaces the single injured_finger column.
alter table public.patients
  add column injured_fingers text[] not null default '{}',
  add column amputated_fingers text[] not null default '{}';

-- Backfill from the round-2 single column.
update public.patients
  set injured_fingers = array[injured_finger]
  where injured_finger is not null;

alter table public.patients drop column injured_finger;

-- Valid values + no overlap between the two arrays.
alter table public.patients
  add constraint injured_fingers_valid
    check (injured_fingers <@ array['pulgar','indice','medio','anular','menique']),
  add constraint amputated_fingers_valid
    check (amputated_fingers <@ array['pulgar','indice','medio','anular','menique']),
  add constraint fingers_no_overlap
    check (not (injured_fingers && amputated_fingers));

comment on column public.patients.injured_fingers is
  'FB-1 (2026-06-06): dedos lesionados (medidos, naranja). Valores idénticos al tipo FingerName de src/lib/hand-tracking.ts. Driver de la medición; sin solapamiento con amputated_fingers.';
comment on column public.patients.amputated_fingers is
  'FB-1 (2026-06-06): dedos amputados (excluidos de la medición, gris discontinuo). Valores idénticos al tipo FingerName de src/lib/hand-tracking.ts. Sin solapamiento con injured_fingers.';
