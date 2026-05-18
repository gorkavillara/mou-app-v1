---
kanban-plugin: board
mou-board-version: 1
---

## 📥 Backlog

- [ ] **B-17** [P1] Documento legal para director médico (Gorka) #backend
- [ ] **F-15** [P2] Modo oscuro completo en panel doctor #frontend
- [ ] **IA-08** [P1] Indicador en vivo de ángulo durante ejercicio (cubierto por F-13) #ia
- [ ] **IA-10** [P2] Estimación de calidad de movimiento (velocidad, suavidad) #ia
- [ ] **IA-12** [P2] Modo "espejo" autovalidación #ia
- [ ] **OPS-1** [P0] Validación con goniómetro de los `measuredOpen/measuredClosed` (Javi) #infra
- [ ] **OPS-2** [P1] Deploy a Vercel preview el 2026-05-14 + QA en iPhone real #infra


## 🔧 En curso

_(vacío)_


## 🧪 En revisión

_(vacío)_


## ✅ Hecho

- [x] **FIX-1** Modal centrado: regla `dialog[open] { margin: auto }` global (Tailwind 4 preflight) + `m-auto` por dialog ✓ 2026-05-11 #frontend
- [x] **FIX-2** `button { cursor: pointer }` globales en `@layer base` (Tailwind 4 los quitó por defecto) ✓ 2026-05-11 #frontend
- [x] **FIX-3** `duration_days` opcional: migración + Zod + `B-11/B-13/B-18` open-ended + UI con pill "Sin fecha de fin" ✓ 2026-05-11 #backend #frontend
- [x] **B-18** [P2] `GET /api/doctor/alerts` (función `stale_patients`, threshold configurable) ✓ 2026-05-09 #backend
- [x] **B-19** [P2] `GET /api/doctor/patients/:id/export.csv` (RFC 4180, BOM UTF-8, cap 50k filas) ✓ 2026-05-09 #backend
- [x] **F-prog** Gráfico Recharts de progresión angular en detalle de paciente ✓ 2026-05-09 #frontend
- [x] **F-adh-7d** Adherencia 7d junto a Total (cards en detalle, caption en lista) ✓ 2026-05-09 #frontend
- [x] **F-16** [P2] "Última sesión hace X" en cada fila + LastSessionBadge ✓ 2026-05-09 #frontend
- [x] **F-12 / IA-07** Animaciones SVG (`FlexionPasivaDedos`, `ExtensionActivaDedos`, `GenericHand`) en cards e intro ✓ 2026-05-09 #ia
- [x] **IA-09** [P1] Detección de "ejercicio mal hecho": `createRepCoaching`/`updateRepCoaching` + toast en sesión ✓ 2026-05-09 #ia
- [x] **IA-11** [P2] Sampling de handedness MediaPipe + aviso one-shot si la mano no coincide ✓ 2026-05-09 #ia
- [x] **B-13** [P1] Adherencia 7d/total: `patient_adherence_window(N)` + view `patient_adherence_breakdown` ✓ 2026-05-09 #backend
- [x] **B-14** [P1] `GET /api/doctor/patients/:id/progression` (function `patient_progression`, filtra low_*) ✓ 2026-05-09 #backend
- [x] **B-16** [P1] `audit_log` + triggers en patients (insert + discharge) y prescriptions (insert) ✓ 2026-05-09 #backend
- [x] **F-13** [P1] Indicador HUD en vivo del ángulo + mini-bars por articulación durante el ejercicio ✓ 2026-05-09 #frontend
- [x] **F-14** [P1] Hoja A4 imprimible con QR (`PrintableQRSheet` + `print:hidden` en el resto) ✓ 2026-05-09 #frontend
- [x] **IA-04** [P0] Página `/dev/calibration` con captura de referencia + JSON pegable ✓ 2026-05-09 #ia
- [x] **IA-05** [P0] Rep counter con histéresis (35°/10°), suavizado 8 frames, peaks por articulación ✓ 2026-05-09 #ia
- [x] **IA-06** [P0] Quality flags `clean/low_confidence/low_visibility/partial` (`classifyRepQuality`) ✓ 2026-05-09 #ia
- [x] **B-11** [P0] `GET /api/patient/:token` (vista paciente vía service_role, 410 al alta, today.sessions_target) ✓ 2026-05-09 #backend
- [x] **B-12** [P0] `POST /api/patient/:token/sessions` (sesión + rep_measurements, validación cross-paciente) ✓ 2026-05-09 #backend
- [x] **B-15** [P1] `GET /api/doctor/patients/:id/qr.png` (PNG con `qrcode`, NEXT_PUBLIC_APP_URL > origin) ✓ 2026-05-09 #backend
- [x] **F-08** [P0] Ruta `/p/[token]` server-rendered con notFound/410/200 ✓ 2026-05-09 #frontend
- [x] **F-09** [P0] PatientHome con "Sesión X de Y" y cards de prescripciones ✓ 2026-05-09 #frontend
- [x] **F-10** [P0] ExerciseSession (intro→running→done) con MediaPipe dinámico, conteo de reps, POST sesión ✓ 2026-05-09 #frontend
- [x] **F-11** [P0] PWA mínima (manifest + Apple meta + iconos placeholder) ✓ 2026-05-09 #frontend
- [x] **DB-base64url** Migración `access_token` a base64url para URLs limpias ✓ 2026-05-09 #infra
- [x] **PATIENT-E2E-001** Test e2e end-to-end del flujo paciente (alta → URL → home → intro) ✓ 2026-05-09 #infra
- [x] **OPS-Tests-E2E** Suite Playwright (12 specs · chromium-desktop + iPhone 12 · capturas por pantalla en `tests/screenshots/`) ✓ 2026-05-09 #infra
- [x] **OPS-E2E-Doctor** Bootstrap idempotente del doctor de pruebas (`npm run e2e:bootstrap`) ✓ 2026-05-09 #infra
- [x] **OPS-A11y** Form labels asociados a inputs (htmlFor) en NewPrescriptionDialog ✓ 2026-05-09 #frontend
- [x] **B-06** [P0] `POST /api/doctor/patients` (alta paciente + access_token, Zod 4, 409 duplicate) ✓ 2026-05-09 #backend
- [x] **B-07** [P0] `GET /api/doctor/patients?search=&status=` con join a `patient_adherence` ✓ 2026-05-09 #backend
- [x] **B-08** [P0] `GET /api/doctor/patients/:id` (paciente + prescripciones + últimas 20 sesiones) ✓ 2026-05-09 #backend
- [x] **B-09** [P0] `POST /api/doctor/patients/:id/prescriptions` ✓ 2026-05-09 #backend
- [x] **B-10** [P0] `POST /api/doctor/patients/:id/discharge` (idempotente) ✓ 2026-05-09 #backend
- [x] **F-02** [P0] Layout `/doctor` (header + logout, DoctorShell) ✓ 2026-05-09 #frontend
- [x] **F-03** [P0] Página `/doctor` lista pacientes con buscador y barra de adherencia ✓ 2026-05-09 #frontend
- [x] **F-04** [P0] Modal "Nuevo paciente" (NewPatientDialog) ✓ 2026-05-09 #frontend
- [x] **F-05** [P0] Página `/doctor/pacientes/[id]` (header, QR, prescripciones, sesiones) ✓ 2026-05-09 #frontend
- [x] **F-06** [P0] Form "Añadir prescripción" con preview live de reps totales ✓ 2026-05-09 #frontend
- [x] **F-07** [P0] Botón "Finalizar rehabilitación" + confirmación ✓ 2026-05-09 #frontend
- [x] **B-05** [P0] Login del doctor (Supabase Auth + middleware + /api/auth/me + /doctor placeholder + logout) ✓ 2026-05-09 #backend
- [x] **OPS-3** Crear doctor (Javi) en Auth + fila en `public.doctors` ✓ 2026-05-09 #infra
- [x] **DOC-1** Vault de Obsidian + CLAUDE.md apuntando al vault como source of truth ✓ 2026-05-08 #infra
- [x] **DOC-2** Convención angular IA-01 documentada (`12-Convencion-angular.md`) ✓ 2026-05-08 #ia
- [x] **B-01** Drop del legado de BD (Prisma + 18 tablas viejas) ✓ 2026-05-09 #backend
- [x] **B-02** Schema Supabase Fase 1 (6 tablas + vista patient_adherence) ✓ 2026-05-09 #backend
- [x] **B-03** Políticas RLS por doctor en todas las tablas ✓ 2026-05-09 #backend
- [x] **B-04** Seed inicial: 2 ejercicios (flexión pasiva / extensión activa) ✓ 2026-05-09 #backend
- [x] **F-01** Borrar legado UI (admin/, doctor/ viejo, dashboard, profile, report) ✓ 2026-05-08 #frontend
- [x] **IA-02** Refactor `hand-tracking.ts`: `calculateJointAngles` por articulación ✓ 2026-05-08 #ia
- [x] **IA-03** Calibración + `normalizeJointAngle` (rango clínico 0–X°) ✓ 2026-05-08 #ia
- [x] **IA-tests** 13 tests unitarios joint-angles + normalización ✓ 2026-05-08 #ia
- [x] **OPS-MCP** `.mcp.json` Supabase + skill de proyecto `supabase-mou` ✓ 2026-05-08 #infra
- [x] **OPS-Scripts** `db:status`, `db:migrate`, `reset-public-schema`, `create-doctor` ✓ 2026-05-09 #infra
- [x] **OPS-Migrate** Migración Fase 1 aplicada en Supabase prod ✓ 2026-05-09 #infra


%% kanban:settings
{
  "kanban-plugin": "board",
  "show-checkboxes": true,
  "lane-width": 320,
  "tag-colors": [
    { "tagKey": "#backend",  "color": "rgba(56, 189, 248, 0.18)" },
    { "tagKey": "#frontend", "color": "rgba(248, 113, 113, 0.18)" },
    { "tagKey": "#ia",       "color": "rgba(167, 139, 250, 0.18)" },
    { "tagKey": "#infra",    "color": "rgba(110, 231, 183, 0.18)" }
  ],
  "show-relative-date": true
}
%%
