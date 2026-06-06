-- UX-5 (2026-05-20): the surgeon wants the intervention date and a short
-- free-text surgical descriptor on the patient record, e.g.
-- "IQ 19/5/26 · Tenorrafia FDP 5º dedo".
-- Anonymity (D3) note: neither field identifies a person. surgery_note is
-- bounded clinical jargon; the UI explicitly instructs not to write names.
alter table public.patients
  add column surgery_date date,
  add column surgery_note text check (char_length(surgery_note) <= 120);

comment on column public.patients.surgery_date is
  'Fecha de la intervención quirúrgica (UX-5). NULL = no especificada.';
comment on column public.patients.surgery_note is
  'Descriptor quirúrgico breve, jerga clínica (UX-5), p.ej. "Tenorrafia FDP 5º dedo". Máx. 120 chars. NUNCA nombres (D3). NULL = no especificado.';
