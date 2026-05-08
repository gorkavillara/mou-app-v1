# 03 — Tareas Backend

> Convenciones: `[P0]` bloqueante para piloto · `[P1]` necesario antes de presentar mutua · `[P2]` deseable.
> Cada tarea es una unidad de PR pequeña.

## P0 — Reset y modelo de datos

### B-01 [P0] Borrar legado de BD
- Drop de migraciones Prisma viejas.
- Crear migración limpia inicial.
- Borrar `prisma/seed*.{sql,ts}`.
- Decidir: **ir solo con Supabase** (sin Prisma) — coherente con commit `5c53ba2`.

### B-02 [P0] Schema Supabase Fase 1
Crear migración con las tablas de [[06-Modelo-datos]]:
- `doctors`, `exercises`, `patients`, `prescriptions`, `sessions`, `rep_measurements`.
- Índices: `patients.access_token (unique)`, `patients.(doctor_id, external_id) (unique)`.
- Triggers: `updated_at` automático donde aplique.

### B-03 [P0] RLS policies
- `doctors`: `auth.uid() = id`.
- `patients`: `doctor_id = auth.uid()`.
- `prescriptions`, `sessions`, `rep_measurements`: vía join con `patients.doctor_id`.
- Política especial: rol `service_role` puede leer/escribir todo (lo usa el endpoint del paciente).

### B-04 [P0] Seed inicial
- 1 doctor (Miguel) creado vía Supabase Auth dashboard manualmente.
- 2 ejercicios en `exercises` (flexión pasiva dedos, extensión activa dedos).

## P0 — Auth doctor

### B-05 [P0] Login del doctor
- Página `/login` (existe; revisarla y simplificar).
- Email + contraseña vía Supabase Auth.
- Redirige a `/doctor` tras login.
- Middleware Next.js que protege todo `/doctor/*` (redirige a `/login` si no hay sesión).
- Logout funcional desde `AppNav`.

## P0 — APIs panel doctor

### B-06 [P0] `POST /api/doctor/patients`
Crea paciente. Body: `{ external_id, pathology_code? }`. Genera `access_token` (UUID o `crypto.randomBytes(32).toString('base64url')`). Devuelve paciente + URL pública.

### B-07 [P0] `GET /api/doctor/patients`
Lista pacientes del doctor. Soporta query `?search=` que filtra por `external_id`. Devuelve adherencia calculada (P1, ver B-13).

### B-08 [P0] `GET /api/doctor/patients/:id`
Detalle del paciente: prescripciones activas, últimas N sesiones, agregados de rep_measurements para gráfico.

### B-09 [P0] `POST /api/doctor/patients/:id/prescriptions`
Crea prescripción. Body: `{ exercise_id, sets, reps_per_set, sessions_per_day, duration_days, starts_on }`.

### B-10 [P0] `POST /api/doctor/patients/:id/discharge`
Marca `discharged_at = today`. Cierra el tratamiento.

## P0 — APIs paciente (sin auth, vía token)

### B-11 [P0] `GET /api/patient/:token`
Recibe el access_token de la URL. Devuelve: prescripciones activas + ejercicios asociados + animation_url.
- Validar que el paciente no está dado de alta (`discharged_at IS NULL`) o que aún sigue dentro de su `duration_days`. Si no, mostrar mensaje de "tratamiento finalizado".

### B-12 [P0] `POST /api/patient/:token/sessions`
Crea sesión. Body: `{ prescription_id, started_at, ended_at, reps_completed, target_reps, rep_measurements: [...] }`.
- Validar token → resolver patient_id.
- Insertar `sessions` + `rep_measurements` en una transacción.

## P1 — Adherencia y agregados

### B-13 [P1] Función SQL / vista de adherencia
Vista materializada o función que devuelve por paciente:
- `sessions_completed_today`, `sessions_prescribed_today`
- `adherence_pct_total` (desde started_at)
- `adherence_pct_last_7d`

Refrescar bajo demanda al cargar el panel del doctor.

### B-14 [P1] `GET /api/doctor/patients/:id/progression`
Devuelve serie temporal de ángulos máximos por articulación, agrupado por día. Sirve al gráfico de evolución.

## P1 — Generación de QR

### B-15 [P1] Endpoint que devuelve QR como PNG
`GET /api/doctor/patients/:id/qr.png` — genera el QR del access URL del paciente. Usar `qrcode` npm. Servir como PNG inline para imprimir desde el navegador.

## P1 — Cumplimiento

### B-16 [P1] Auditoría mínima
Tabla `audit_log` con: doctor_id, action, target_id, payload (jsonb), created_at. Triggers en `patients`, `prescriptions`, `discharge`. Sin esto no podemos demostrar trazabilidad si la mutua pregunta.

### B-17 [P1] Documento legal para director médico
Redactar email + adjunto explicando: qué datos se capturan (ángulos, sin PII), retención (90 días tras discharge), responsable, base legal (interés legítimo / consentimiento del paciente al escanear). [[02-Decisiones-clave#D13]].
- *Tarea de Arnau, no de Claude. Pero la trackeamos aquí.*

## P2 — Nice to have

### B-18 [P2] Webhook a Slack/email cuando un paciente lleva 48h sin sesión
Para que Miguel vea un "rojo" sin entrar al panel.

### B-19 [P2] Export CSV de un paciente
Para llevarlo a la reunión con la mutua si toca.
