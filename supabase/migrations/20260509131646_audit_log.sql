-- =============================================================================
-- B-16 — Audit log mínimo (paciente / prescripción)
--
-- Tabla append-only que registra creación de pacientes, alta del tratamiento
-- (discharge) y creación de prescripciones. Sin esto no podemos demostrar
-- trazabilidad si la mutua audita.
--
-- Decisiones:
--   * No registramos UPDATE genérico de patients — sólo la transición
--     "discharged_at IS NULL → NOT NULL". Cualquier otro update es ruido para
--     la mutua y polluiría el log.
--   * actor_id puede ser NULL: el flujo paciente (`/api/patient/:token`)
--     escribe via service_role sin auth.uid(). Esto es esperado y la mutua
--     entiende esa columna como "sistema vs doctor".
--   * doctor_id es NOT NULL: el ámbito de cada fila es el doctor responsable
--     del paciente. La RLS filtra por ahí.
--   * Triggers `security definer` para escribir incluso cuando el caller
--     (paciente vía service_role) no tiene policy de INSERT en audit_log.
--
-- Verificación manual (no hay tests Vitest porque los triggers son
-- integration-level y el stub chainable no los puede ejercitar). Tras
-- aplicar la migración, ejecutar contra la BD:
--
--   1. insert into patients (doctor_id, external_id) values (<uid>, 'AUD-1');
--      → audit_log debe tener una fila action='patient.created'
--   2. insert into prescriptions (patient_id, exercise_id, sets, reps_per_set,
--          sessions_per_day, duration_days) values (...);
--      → action='prescription.created' con payload completo
--   3. update patients set discharged_at = current_date where external_id = 'AUD-1';
--      → action='patient.discharged'
--   4. update patients set updated_at = now() where external_id = 'AUD-1';
--      → NO genera fila en audit_log (intencional)
-- =============================================================================

create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id),
  action text not null check (action in (
    'patient.created', 'patient.discharged',
    'prescription.created'
  )),
  target_kind text not null check (target_kind in ('patient','prescription')),
  target_id uuid not null,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  payload jsonb
);

comment on table public.audit_log is
  'Registro append-only de creación de pacientes, alta y prescripciones. Trazabilidad para mutua (B-16).';

create index audit_log_doctor_time on public.audit_log (doctor_id, occurred_at desc);

alter table public.audit_log enable row level security;

create policy audit_log_select_own on public.audit_log
  for select using (doctor_id = auth.uid());

-- =============================================================================
-- Trigger: patient.created
-- =============================================================================
create or replace function public.audit_log_patient_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor_id, action, target_kind, target_id, doctor_id, payload)
  values (
    auth.uid(),
    'patient.created',
    'patient',
    new.id,
    new.doctor_id,
    jsonb_build_object(
      'external_id', new.external_id,
      'pathology_code', new.pathology_code
    )
  );
  return new;
end;
$$;

create trigger trg_audit_patient_created
  after insert on public.patients
  for each row execute function public.audit_log_patient_created();

-- =============================================================================
-- Trigger: patient.discharged (sólo cuando NULL → NOT NULL)
-- =============================================================================
create or replace function public.audit_log_patient_discharged()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.discharged_at is null and new.discharged_at is not null then
    insert into public.audit_log (actor_id, action, target_kind, target_id, doctor_id, payload)
    values (
      auth.uid(),
      'patient.discharged',
      'patient',
      new.id,
      new.doctor_id,
      jsonb_build_object('discharged_at', new.discharged_at)
    );
  end if;
  return new;
end;
$$;

create trigger trg_audit_patient_discharged
  after update on public.patients
  for each row execute function public.audit_log_patient_discharged();

-- =============================================================================
-- Trigger: prescription.created
-- Resolvemos doctor_id desde patients porque prescriptions sólo guarda
-- patient_id.
-- =============================================================================
create or replace function public.audit_log_prescription_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_doctor_id uuid;
begin
  select doctor_id into v_doctor_id from public.patients where id = new.patient_id;
  if v_doctor_id is null then
    -- No debería pasar (FK cubre el caso), pero si pasa preferimos no fallar
    -- el insert original — mejor un log perdido que romper el flujo doctor.
    return new;
  end if;

  insert into public.audit_log (actor_id, action, target_kind, target_id, doctor_id, payload)
  values (
    auth.uid(),
    'prescription.created',
    'prescription',
    new.id,
    v_doctor_id,
    jsonb_build_object(
      'patient_id', new.patient_id,
      'exercise_id', new.exercise_id,
      'sets', new.sets,
      'reps_per_set', new.reps_per_set,
      'sessions_per_day', new.sessions_per_day,
      'duration_days', new.duration_days,
      'starts_on', new.starts_on,
      'replaces_id', new.replaces_id
    )
  );
  return new;
end;
$$;

create trigger trg_audit_prescription_created
  after insert on public.prescriptions
  for each row execute function public.audit_log_prescription_created();
