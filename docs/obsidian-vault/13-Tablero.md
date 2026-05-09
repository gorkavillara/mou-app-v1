---
kanban-plugin: board
mou-board-version: 1
---

## 📥 Backlog

- [ ] **B-06** [P0] `POST /api/doctor/patients` (alta paciente + access_token) #backend
- [ ] **B-07** [P0] `GET /api/doctor/patients` (lista + buscador por external_id) #backend
- [ ] **B-08** [P0] `GET /api/doctor/patients/:id` (detalle paciente) #backend
- [ ] **B-09** [P0] `POST /api/doctor/patients/:id/prescriptions` #backend
- [ ] **B-10** [P0] `POST /api/doctor/patients/:id/discharge` #backend
- [ ] **B-11** [P0] `GET /api/patient/:token` (vista paciente sin auth) #backend
- [ ] **B-12** [P0] `POST /api/patient/:token/sessions` (persistir sesión + reps) #backend
- [ ] **B-13** [P1] Vista/función SQL de adherencia avanzada (7d, total) #backend
- [ ] **B-14** [P1] `GET /api/doctor/patients/:id/progression` (serie temporal por articulación) #backend
- [ ] **B-15** [P1] Endpoint que devuelve QR como PNG #backend
- [ ] **B-16** [P1] Tabla `audit_log` + triggers en patients/prescriptions/discharge #backend
- [ ] **B-17** [P1] Documento legal para director médico (Gorka) #backend
- [ ] **B-18** [P2] Webhook Slack/email cuando paciente lleva 48h sin sesión #backend
- [ ] **B-19** [P2] Export CSV de un paciente #backend
- [ ] **F-02** [P0] Layout `/doctor` nuevo (header + dark mode) #frontend
- [ ] **F-03** [P0] Página `/doctor` lista pacientes con buscador y % adherencia #frontend
- [ ] **F-04** [P0] Modal "Nuevo paciente" (external_id + patología) #frontend
- [ ] **F-05** [P0] Página `/doctor/pacientes/[id]` (cabecera, QR, prescripciones, gráficos) #frontend
- [ ] **F-06** [P0] Form "Añadir prescripción" (sets×reps×freq×días) #frontend
- [ ] **F-07** [P0] Botón "Finalizar rehabilitación" con confirmación #frontend
- [ ] **F-08** [P0] Ruta `/p/[token]/page.tsx` con token validation server-side #frontend
- [ ] **F-09** [P0] Pantalla "qué toca ahora" para el paciente #frontend
- [ ] **F-10** [P0] Adaptar `exercises/page.tsx` al flujo Fase 1 + POST sesión #frontend
- [ ] **F-11** [P0] PWA mínima (manifest + meta Apple) #frontend
- [ ] **F-12** [P1] Componente `<ExerciseAnimation>` con mano animada #frontend
- [ ] **F-13** [P1] Indicador en vivo del ángulo durante el ejercicio #frontend
- [ ] **F-14** [P1] Pantalla de impresión QR (CSS @media print) #frontend
- [ ] **F-15** [P2] Modo oscuro completo en panel doctor #frontend
- [ ] **F-16** [P2] Indicador "última sesión hace X horas" en lista #frontend
- [ ] **IA-04** [P0] Página `/dev/calibration` (test visual de cordura) #ia
- [ ] **IA-05** [P0] Revisar conteo de reps con los nuevos ángulos por articulación #ia
- [ ] **IA-06** [P0] Filtrado de mediciones inválidas (low_visibility, low_confidence) #ia
- [ ] **IA-07** [P1] Producción de 2 animaciones Lottie/GIF de mano #ia
- [ ] **IA-08** [P1] Indicador en vivo de ángulo durante ejercicio #ia
- [ ] **IA-09** [P1] Detección de "ejercicio mal hecho" + aviso #ia
- [ ] **IA-10** [P2] Estimación de calidad de movimiento (velocidad, suavidad) #ia
- [ ] **IA-11** [P2] Detección de mano correcta (handedness) #ia
- [ ] **IA-12** [P2] Modo "espejo" autovalidación #ia
- [ ] **OPS-1** [P0] Validación con goniómetro de los `measuredOpen/measuredClosed` (Javi) #infra
- [ ] **OPS-2** [P1] Deploy a Vercel preview el 2026-05-14 + QA en iPhone real #infra


## 🔧 En curso

_(vacío — siguiente: B-06 alta de paciente)_


## 🧪 En revisión

_(vacío)_


## ✅ Hecho

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
