-- =============================================================================
-- Mou — Fase 1: schema inicial
-- Referencia: docs/obsidian-vault/06-Modelo-datos.md
--
-- Decisiones clave aplicadas:
--   D3: pacientes anónimos (sin name/email/phone/dob)
--   D5: prescripciones parametrizables (sets × reps × frecuencia × duración)
--   D7: cada paciente tiene un access_token único para acceso vía URL
--   D11: medidas angulares por articulación (MCP, PIP, DIP, wrist) en rep_measurements
-- =============================================================================

-- Extensiones
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================================
-- doctors
-- =============================================================================
create table public.doctors (
  id uuid primary key references auth.users(id) on delete cascade,
  external_label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.doctors is 'Médicos con acceso al panel. id = auth.users.id.';

-- =============================================================================
-- exercises (catálogo)
-- =============================================================================
create table public.exercises (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name text not null,
  description text,
  animation_url text,
  tracked_joints text[] not null default '{}',
  target_finger text not null check (target_finger in ('thumb','index','middle','ring','pinky','all')),
  created_at timestamptz not null default now()
);

comment on table public.exercises is 'Catálogo global de ejercicios disponibles. Compartido entre doctores.';
comment on column public.exercises.tracked_joints is 'Articulaciones a medir: wrist, MCP, PIP, DIP.';

-- =============================================================================
-- patients
-- =============================================================================
create table public.patients (
  id uuid primary key default uuid_generate_v4(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  external_id text not null,
  pathology_code text check (pathology_code in ('flexor','extensor','otros')),
  access_token text not null unique default encode(gen_random_bytes(24), 'base64'),
  started_at date not null default current_date,
  discharged_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doctor_id, external_id)
);

comment on table public.patients is
  'Pacientes anónimos. Identificados por external_id (nº historia o correlativo). Sin PII.';
comment on column public.patients.access_token is
  'Token aleatorio en URL del paciente. No guardar PII en otra columna — la asociación ID↔persona vive en el Excel del doctor.';

create index idx_patients_doctor on public.patients (doctor_id);
create index idx_patients_token on public.patients (access_token);

-- =============================================================================
-- prescriptions
-- =============================================================================
create table public.prescriptions (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  sets int not null check (sets > 0),
  reps_per_set int not null check (reps_per_set > 0),
  sessions_per_day int not null check (sessions_per_day > 0),
  duration_days int not null check (duration_days > 0),
  starts_on date not null default current_date,
  replaces_id uuid references public.prescriptions(id),
  created_at timestamptz not null default now()
);

comment on table public.prescriptions is
  'Pauta del paciente. Si se modifica, se crea una nueva fila con replaces_id apuntando a la previa (auditoría).';

create index idx_prescriptions_patient on public.prescriptions (patient_id);
create index idx_prescriptions_active on public.prescriptions (patient_id, starts_on);

-- =============================================================================
-- sessions
-- =============================================================================
create table public.sessions (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  prescription_id uuid not null references public.prescriptions(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  reps_completed int not null default 0,
  target_reps int not null,
  completion_pct numeric(5,2) generated always as (
    case when target_reps = 0 then 0
         else round((reps_completed::numeric / target_reps::numeric) * 100, 2)
    end
  ) stored,
  client_metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_sessions_patient_date on public.sessions (patient_id, started_at desc);

-- =============================================================================
-- rep_measurements
-- =============================================================================
create table public.rep_measurements (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  rep_index int not null,
  joint text not null,
  max_flexion_deg numeric(5,2),
  max_extension_deg numeric(5,2),
  quality_flag text check (quality_flag in ('clean','low_visibility','low_confidence','partial')),
  recorded_at timestamptz not null default now()
);

comment on table public.rep_measurements is
  'Una fila por (rep × articulación). Granular para no perder dato clínico (D11).';

create index idx_rep_session on public.rep_measurements (session_id);

-- =============================================================================
-- updated_at triggers
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_doctors_updated_at
  before update on public.doctors
  for each row execute function public.set_updated_at();

create trigger trg_patients_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row-Level Security
-- =============================================================================
alter table public.doctors          enable row level security;
alter table public.exercises        enable row level security;
alter table public.patients         enable row level security;
alter table public.prescriptions    enable row level security;
alter table public.sessions         enable row level security;
alter table public.rep_measurements enable row level security;

-- doctors: cada uno ve solo su fila
create policy doctors_select_self
  on public.doctors for select
  using (auth.uid() = id);

create policy doctors_update_self
  on public.doctors for update
  using (auth.uid() = id);

-- exercises: cualquier doctor autenticado los lee (catálogo compartido)
create policy exercises_select_authenticated
  on public.exercises for select
  using (auth.role() = 'authenticated');

-- patients: del doctor logueado
create policy patients_all_own
  on public.patients for all
  using (doctor_id = auth.uid())
  with check (doctor_id = auth.uid());

-- prescriptions / sessions / rep_measurements: vía join con patients
create policy prescriptions_all_own
  on public.prescriptions for all
  using (patient_id in (select id from public.patients where doctor_id = auth.uid()))
  with check (patient_id in (select id from public.patients where doctor_id = auth.uid()));

create policy sessions_all_own
  on public.sessions for all
  using (patient_id in (select id from public.patients where doctor_id = auth.uid()))
  with check (patient_id in (select id from public.patients where doctor_id = auth.uid()));

create policy rep_measurements_all_own
  on public.rep_measurements for all
  using (session_id in (
    select s.id from public.sessions s
    join public.patients p on p.id = s.patient_id
    where p.doctor_id = auth.uid()
  ))
  with check (session_id in (
    select s.id from public.sessions s
    join public.patients p on p.id = s.patient_id
    where p.doctor_id = auth.uid()
  ));

-- service_role bypassa RLS por defecto en Supabase. El acceso del paciente
-- vía /api/patient/[token] usa el service_role key del lado servidor;
-- nunca se expone en el cliente.

-- =============================================================================
-- Vista de adherencia (cálculo on-demand)
-- =============================================================================
create or replace view public.patient_adherence as
with prescription_targets as (
  select
    p.id as patient_id,
    p.doctor_id,
    sum(pr.sessions_per_day * least(pr.duration_days,
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
  'Adherencia: sesiones completadas vs prescritas hasta hoy.';

-- =============================================================================
-- Catálogo inicial: los 2 ejercicios de la D4
-- =============================================================================
insert into public.exercises (code, name, description, tracked_joints, target_finger) values
  ('flexion-pasiva-dedos',
   'Flexión pasiva de dedos',
   'Con la mano contraria, dobla los dedos de la mano operada hacia la palma. Mantén unos segundos y vuelve a abrir.',
   array['MCP','PIP','DIP'],
   'all'),
  ('extension-activa-dedos',
   'Extensión activa de dedos',
   'Con los dedos doblados, estira activamente los dedos hasta abrir la mano completamente.',
   array['MCP','PIP','DIP'],
   'all');
