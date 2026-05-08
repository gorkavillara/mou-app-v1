# 06 — Modelo de datos Fase 1

## Stack
- **Supabase** (Postgres + Auth) — ya está integrado en el proyecto.
- Prisma se descarta por ahora; se usa el cliente de Supabase directo (consistente con el commit `5c53ba2`).
- Row-Level Security activado donde toque.

## Tablas

### `doctors`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` de Supabase Auth |
| `external_label` | text | "Dr. Javi" — solo para mostrar en UI |
| `created_at` | timestamptz | |

> En la Fase 1 hay **un único doctor**. Pero modelamos la tabla porque "convertir a multi-doctor después" es trivial si está desde el principio.

### `exercises` (catálogo)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `code` | text UNIQUE | `flexion-pasiva-dedos`, `extension-activa-dedos` |
| `name` | text | "Flexión pasiva de dedos" |
| `description` | text | Cómo se hace |
| `animation_url` | text | URL al GIF/animación de mano |
| `tracked_joints` | text[] | `['MCP', 'PIP', 'DIP']` o `['wrist']` |
| `target_finger` | text | `index|middle|ring|pinky|thumb|all` |
| `created_at` | timestamptz | |

Seed inicial: 2 filas (los 2 ejercicios de la D4).

### `patients`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `doctor_id` | uuid FK→doctors | |
| `external_id` | text | Nº historia clínica O correlativo. Único por doctor. |
| `pathology_code` | text | Opcional: `flexor`, `extensor`, `otros`. **No** descripciones libres. |
| `access_token` | text UNIQUE | Token largo aleatorio para la URL del paciente |
| `started_at` | date | Fecha de alta del tratamiento |
| `discharged_at` | date NULL | Si NULL → activo. Si fecha → dado de alta. |
| `created_at` | timestamptz | |

⚠️ **PII prohibida**: nada de `name`, `email`, `phone`, `dob`. RLS debe rechazar inserts con esas columnas si se añadieran por error.

### `prescriptions`
Una por paciente activa. Si el doctor cambia la pauta, se crea una nueva con `replaces_id` apuntando a la anterior (auditoría).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `patient_id` | uuid FK | |
| `exercise_id` | uuid FK→exercises | |
| `sets` | int | ej. 3 |
| `reps_per_set` | int | ej. 20 |
| `sessions_per_day` | int | ej. 8 (cada 3h ≈ 8/día) |
| `duration_days` | int | ej. 14 |
| `starts_on` | date | |
| `replaces_id` | uuid NULL FK→prescriptions | |
| `created_at` | timestamptz | |

Un paciente puede tener **múltiples prescripciones simultáneas** (ej. flexión pasiva + extensión activa) → es lo normal, no excepción.

### `sessions`
Cada vez que el paciente abre la URL y completa una "tanda" de ejercicios.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `patient_id` | uuid FK | |
| `prescription_id` | uuid FK | A qué prescripción cuenta |
| `started_at` | timestamptz | |
| `ended_at` | timestamptz NULL | |
| `reps_completed` | int | Cuántas reps detectó la cámara |
| `target_reps` | int | sets × reps_per_set en la prescripción a esa fecha |
| `completion_pct` | numeric | reps_completed / target_reps × 100 |
| `client_metadata` | jsonb | user agent, viewport, etc. |

### `rep_measurements`
Una fila por **cada repetición** detectada. Es la materia prima clínica.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK | |
| `rep_index` | int | 1, 2, 3… dentro de la sesión |
| `joint` | text | `wrist`, `MCP-index`, `PIP-index`, `DIP-index`, … |
| `max_flexion_deg` | numeric | Pico de flexión en esta rep |
| `max_extension_deg` | numeric | Pico de extensión en esta rep |
| `quality_flag` | text NULL | `low_visibility`, `low_confidence`, `clean`, … |
| `recorded_at` | timestamptz | |

> Mantener el detalle por articulación porque la D11 lo exige clínicamente. Si después se quiere agregar para gráficos, se hace en consulta SQL, no se pierde el dato granular.

## Vistas / cálculos derivados (no tabla)

### Adherencia
```sql
-- % adherencia de un paciente entre alta y hoy (o discharged_at)
adherence = sessions_realizadas_hoy / sessions_prescritas_hoy
```
Donde `sessions_prescritas_hoy = sessions_per_day × días_transcurridos × n_prescripciones`. Cuidado al promediar entre prescripciones distintas: mejor mostrar **una barra por prescripción** que un único % opaco.

## RLS (Row-Level Security)
- `doctors`: cada uno solo se ve a sí mismo.
- `patients`, `prescriptions`, `sessions`, `rep_measurements`: filtrados por `doctor_id` directo o vía `patient_id → patients.doctor_id`.
- **Acceso del paciente vía URL**: NO autenticado vía Supabase Auth. Se usa una **API route Next.js** que recibe el `access_token`, valida contra `patients.access_token`, y usa el service role key del lado servidor. Nunca se expone el client de Supabase con privilegios al navegador del paciente.

## Migración desde el legado
Borrón total. No hay datos reales todavía (commit `2977ff0` era seeding de prueba). Drop schema → recrear.
