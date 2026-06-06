# 08 — Legado a eliminar

> **Antes de programar nada de la Fase 1**, borrar el siguiente código. Las decisiones de la reunión hacen estos prototipos obsoletos: pacientes con PII, panel admin, mensajería, mutuas, etc. Si no se eliminan ahora, el modelo de datos nuevo se pisa con el viejo.

## Rutas de la app a borrar
- `src/app/admin/` — completo (admin no existe en Fase 1).
- `src/app/doctor/` — completo (se reescribe desde cero, NO mantener).
- `src/app/dashboard/` — sólo si era del prototipo viejo del paciente; **comprobar antes de borrar**.
- `src/app/patient/` — revisar si pisa con `exercises/`. Si es prototipo, fuera.
- `src/app/auth/`, `src/app/forgot-password/`, `src/app/reset-password/` — solo si se decide cambiar de stack auth. Si se mantiene Supabase Auth simplificado, conservar.

## API routes a borrar
Todas estas son del prototipo viejo:
- `src/app/api/admin/`
- `src/app/api/doctor/`
- `src/app/api/doctors/`
- `src/app/api/insurances/` (mutuas no se modelan en Fase 1)
- `src/app/api/messages/` (mensajería fuera de alcance)
- `src/app/api/mutuas/`
- `src/app/api/notes/`
- `src/app/api/patients/` — revisar; probablemente reescribir.
- `src/app/api/recordings/` — revisar; ¿guardamos vídeo? Decisión: **no en Fase 1**, solo métricas. Borrar.
- `src/app/api/assignments/` — se reescribe con el nuevo modelo de prescripción.
- `src/app/api/consent/`, `src/app/api/debug/`, `src/app/api/tasks/` — revisar y borrar lo que no encaje.

**Mantener si aplica**: `src/app/api/auth/` (login doctor), `src/app/api/sessions/` (datos capturados por la cámara — base útil), `src/app/api/metrics/` (idem), `src/app/api/patient/` (vista paciente vía token URL).

## Componentes a borrar
- `src/components/admin/` — completo.
- `src/components/doctor/` — completo (se reescribe).
- Conservar: `src/components/exercises/`, `src/components/dashboard/` (revisar cuáles son del paciente), `src/components/report/`, `src/components/AppNav.tsx`, `src/components/LoginPage.tsx`.

## Lib / utilidades
- `src/lib/doctor-api.ts`, `src/lib/doctor-types.ts`, `src/lib/doctor-utils.ts` — borrar y reescribir contra el nuevo modelo.
- `src/lib/consent.ts`, `src/lib/consent-integration.ts` — revisar; probablemente simplificar a un flag por paciente.
- `src/lib/encryption.ts` — evaluar si se sigue usando. Si no se almacena PII, sobra.
- `src/lib/notifications.ts` — fuera (no hay push en Fase 1).
- `src/lib/prisma.ts` + `prisma/` directorio — **decisión**: mantener Prisma o ir solo con Supabase client. La rama actual `master` apunta a *"use Supabase instead of Prisma for APIs"* (commit `5c53ba2`). Decidir y unificar — ver [[06-Modelo-datos]].

## Base de datos
- Migraciones existentes en `prisma/migrations/` — reescribir como **un único schema limpio** para Fase 1.
- `seed.sql`, `seed.ts`, `seed_exercises.sql` — borrar y reescribir un seed mínimo (1 doctor + catálogo de 2 ejercicios + 0 pacientes).
- Tabla `insurances` (mutuas) — fuera del esquema.
- Tablas con campos PII (nombre, email, teléfono del paciente) — eliminar columnas.

## Procedimiento sugerido
1. Crear rama `feat/fase1-reset` desde `master`.
2. **Primer commit**: solo borrados, sin nada nuevo. Que la app no compile es OK temporalmente.
3. **Segundo commit**: schema y migraciones limpias del modelo nuevo (ver [[06-Modelo-datos]]).
4. A partir de ahí, ir construyendo el panel siguiendo [[03-Tareas-Backend]] → [[04-Tareas-Frontend]].

## Lo que SÍ se conserva intacto
- `src/app/exercises/page.tsx` — vista paciente.
- `src/lib/hand-tracking.ts` — núcleo de IA. Se modifica para [[10-Algoritmo-IA-normalizacion]] pero no se tira.
- `src/components/exercises/` — funcionando.
- `src/data/patients.ts` — borrar (era mock).
