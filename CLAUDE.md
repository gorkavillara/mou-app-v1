# Mou - Hand Rehabilitation Platform

## ⚠️ Source of truth: Obsidian vault

**Antes de tocar nada en este proyecto, leer `docs/obsidian-vault/`.** Es la fuente de verdad de:
- Visión, alcance y decisiones (`02-Decisiones-clave.md`).
- Backlog priorizado (`03-Tareas-Backend.md`, `04-Tareas-Frontend.md`, `05-Tareas-IA.md`).
- Modelo de datos (`06-Modelo-datos.md`).
- Plan de piloto y cronograma (`07-Plan-piloto-20-pacientes.md`).
- Legado a eliminar (`08-Legado-a-eliminar.md`).

Si una decisión cambia → **actualizar el vault primero**, luego implementar. No documentar decisiones sólo en commits o en CLAUDE.md.

Estamos en **Fase 1**: panel doctor + piloto 20 pacientes anónimos. Todo lo previo a este punto (panel admin, mensajería, mutuas, doctor antiguo) está deprecado y se está borrando — ver `08-Legado-a-eliminar.md`.

### Mantener el tablero al día
`docs/obsidian-vault/13-Tablero.md` es un kanban con cuatro columnas: **Backlog · En curso · En revisión · Hecho**. Reglas:

1. **Antes de empezar una tarea**: moverla a *En curso* (mover la línea `- [ ]` a la columna correspondiente).
2. **Al terminar y antes de pedir review** (o de hacer commit final si no hay review): pasarla a *En revisión* o directamente a *Hecho* si se mergea.
3. **Al cerrarla**: marcar el checkbox `- [x]` y añadir `✓ YYYY-MM-DD` con la fecha del día.
4. Si aparece una tarea nueva no listada → añadirla al *Backlog* con un ID coherente (`B-`, `F-`, `IA-`, `OPS-`) y la prioridad entre corchetes (`[P0]`, `[P1]`, `[P2]`).
5. La tag de área (`#backend`, `#frontend`, `#ia`, `#infra`) es obligatoria — el plugin Kanban las usa para colorear.

El tablero debe reflejar el estado real, no la intención. Si una tarea está parada por bloqueo externo, vuelve al Backlog con una nota del bloqueo, no se queda en *En curso*.

## Project Overview
Mou is a hand/finger rehabilitation platform using MediaPipe for real-time hand tracking via webcam. It serves two roles: patients (exercises, progress tracking) and doctors (patient monitoring, alerts).

## Tech Stack
- **Framework**: Next.js 16.x (App Router, Turbopack)
- **Language**: TypeScript 5 (strict mode)
- **UI**: Tailwind CSS 4, Framer Motion, Lucide icons
- **Charts**: Recharts 3
- **Hand Tracking**: @mediapipe/tasks-vision (Hand Landmarker, float16 model)
- **PDF Export**: jsPDF
- **Package Manager**: npm

## Project Structure
```
src/
  app/                    # Next.js App Router pages
    exercises/page.tsx    # Core: hand tracking exercise session
    dashboard/page.tsx    # Patient dashboard
    doctor/               # Doctor panel (dashboard, pacientes/[id])
    report/page.tsx       # Rehabilitation report with PDF export
    profile/page.tsx      # Patient profile
    login/page.tsx        # Login (hardcoded prototype)
  components/
    exercises/            # Exercise UI: MetricsGrid, MetricCard, ExerciseDemo, FingerSelector, DashboardHeader
    dashboard/            # Dashboard cards: IFRM, Adherence, Quality, Progress, etc.
    report/               # Report sections: PatientHeader, Summary, Progress, etc.
    LoginPage.tsx
  lib/
    hand-tracking.ts      # Hand tracking utilities: angle calculations, drawing, rep counting
  data/
    patients.ts           # Mock patient database (4 patients)
```

## Key Architecture Decisions
- **No backend**: All data is mock/in-memory. No database, no auth system yet.
- **Component-level state**: No global state management (Redux/Context). Metrics live in the exercises page.
- **MediaPipe via CDN**: Model loaded from Google Storage CDN with GPU→CPU fallback.
- **Spanish UI**: All user-facing text is in Spanish.

## Hand Tracking (src/lib/hand-tracking.ts)
- **21 landmarks** per hand from MediaPipe
- **Virtual forearm point**: Projected from wrist opposite to hand direction for wrist F/E reference line
- **Wrist angle**: Measured between forearm→wrist and wrist→middleMCP vectors
- **Finger angles**: Measured per finger between wrist→MCP and MCP→TIP vectors
- **Repetition counting**: Sliding window average over 10 frames, threshold crossing at ±15°
- **Per-rep tracking**: Each rep records max flexion and max extension achieved
- **Finger status**: Each finger can be `normal`, `injured` (orange, tracked), or `amputated` (gray, excluded)

## Landmark Reference
```
0: Wrist | 1-4: Thumb | 5-8: Index | 9-12: Middle | 13-16: Ring | 17-20: Pinky
Per finger: [MCP, PIP, DIP, TIP]
```

## Development Commands
```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest unit suite
npm run e2e          # Playwright e2e (creates e2e doctor + runs all projects)
npm run e2e:headed   # Playwright e2e with visible browser
npm run e2e:ui       # Playwright UI mode
npm run e2e:report   # Open last HTML report under tests/.report
```

## E2E tests (Playwright)

- **Config**: `playwright.config.ts`. Runs against `npm run dev` on :3500.
- **Structure** (one folder per page):
  - `tests/base-page.ts` — shared Page Object base (navigation, screenshots).
  - `tests/helpers.ts` — `authedTest` fixture, `generatePatientId`, env constants.
  - `tests/auth.setup.ts` — logs in as the E2E doctor and saves storageState to `tests/.auth/doctor.json`.
  - `tests/login/`, `tests/doctor-list/`, `tests/doctor-detail/` — each has `*-page.ts` (POM) + `*.spec.ts` + `*.md`.
- **Authentication**: `scripts/create-e2e-doctor.ts` (alias `npm run e2e:bootstrap`) idempotently creates `e2e@mou.local` in Supabase Auth + `public.doctors` and resets the password to `MOU_E2E_PASSWORD` from `.env`. The auth.setup project logs that user in via the real form once per run; authed specs reuse that storage state.
- **Screenshots**: each spec calls `page.snap(testInfo, name)` to write a PNG to `tests/screenshots/<name>.png` AND attach it to the HTML report. Screenshots are committed to git (small, per-page snapshots; useful as a visual reference and for review).
- **Anonymity rule**: every test patient must use `generatePatientId()` (`E2E-<timestamp>` style). NEVER use real names, emails or PII inside test data.
- **Skill**: `.claude/skills/playwright-cli/SKILL.md` is installed for interactive browser exploration via `playwright-cli`. Use it during test design before writing assertions.

## Coding Conventions

### Next.js
- Use App Router (`src/app/`) for all pages
- Mark client components with `'use client'` at top of file
- Keep pages thin: delegate logic to components and utility modules
- Use `@/` path alias for imports from `src/`

### TypeScript
- Define explicit types for props, state, and function parameters
- Use `type` over `interface` for consistency (project convention)
- Avoid `any` - use proper types or `unknown` when type is uncertain
- Export types alongside their functions from utility modules

### Components
- One component per file, named export matching filename
- Props type defined as `type [ComponentName]Props` at top of file
- Colocate related components in feature folders (`components/exercises/`, etc.)

### Styling
- Tailwind CSS utility classes only - no custom CSS files per component
- iOS-inspired design: rounded corners, subtle shadows, blue (#007AFF) primary
- Background: `bg-gray-50` (#F2F2F7), cards: white with `border-gray-100`
- Mobile-first responsive design

### State Management
- React `useState`/`useRef` for component state
- `useRef` for values needed in animation loops (avoids stale closures)
- Keep refs synced with state via `ref.current = stateValue` pattern when needed in callbacks

### Clean Code
- Functions should do one thing. Extract calculations into `src/lib/` utilities.
- Avoid magic numbers: use named constants (e.g., `TARGET_REPS`, threshold values)
- Keep the render method readable: extract complex JSX into named components
- No dead code - remove unused imports, variables, and functions

## Notion Sync (SDD Tasks)

This project uses Notion for tracking SDD tasks.

### Configuration (Pre-configured)
- **Database ID**: `31c5bfba29cd80cc9b0ccf351b7af1ae`
- **Database URL**: https://www.notion.so/gorkavillar/31c5bfba29cd80cc9b0ccf351b7af1ae
- **Status Options**: Por hacer → En progreso → Completado

### MCP Server
The Notion MCP is configured in this project's Claude config:
```bash
claude mcp list  # Verify: notion: npx -y @notionhq/notion-mcp-server - ✓ Connected
```

### Operations

**Sync Tasks**: Create all tasks from SDD task plan in Notion
**Update Status**: Mark tasks as "En progreso" or "Completado"

### API Usage
```bash
# Create task
curl -X POST -H "Authorization: Bearer YOUR_NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" "https://api.notion.com/v1/pages" \
  -d '{"parent": {"database_id": "31c5bfba29cd80cc9b0ccf351b7af1ae"}, "properties": {...}}'

# Update status
curl -X PATCH -H "Authorization: Bearer YOUR_NOTION_TOKEN" "https://api.notion.com/v1/pages/{id}" \
  -d '{"properties": {"Status": {"status": {"name": "Completado"}}}}'
```
