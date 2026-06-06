# Feedback Gorka — 2026-06-06 (smoke post-calibración)

Contexto: smoke manual sobre https://mou-v1.vercel.app/ tras integrar la calibración técnica y los fixes de las rondas 1-3.

## 1. Dedos lesionados: múltiples y con estado

> Solo puedo seleccionar un dedo lesionado, tengo que poder seleccionar uno o más de uno y que sean lesionados o amputados.

- El modelo actual (`patients.injured_finger`, un solo dedo) se queda corto: una mano operada puede tener **varios dedos afectados**, y la distinción **lesionado vs amputado** importa clínicamente:
  - **Lesionado** → se mide (driver de la medición), se pinta naranja.
  - **Amputado** → se EXCLUYE de la medición (no hay dedo que medir), se pinta gris discontinuo. El lib (`hand-tracking.ts`) ya soporta los tres estados (`normal | injured | amputated`) desde la Fase 0 — era el modelo original; al introducir `injured_finger` en la Ronda 2 lo simplificamos de más.
- **Decisión de modelo**: dos arrays en `patients` — `injured_fingers text[]` y `amputated_fingers text[]` (valores = los 5 dedos en español, sin solapamiento entre ambos). Migración con backfill desde `injured_finger` y drop de la columna vieja.
- **Medición**: driver = promedio de los dedos *lesionados* (si hay varios); amputados excluidos siempre; sin lesionados → fallback al `target_finger` del ejercicio excluyendo amputados.

## 2. Contraste en la pantalla "sesión terminada" (paciente)

> Los títulos aparecen en gris (sobre fondo claro) entonces no se ven demasiado. El resto está de puta madre.

- Fase `done` de `ExerciseSession`: los títulos usan un gris demasiado claro sobre fondo claro. Subir contraste (gray-900 para títulos, mantener jerarquía con secundarios en gray-600).

## Estado

- [x] FB-1 multi-dedo + amputados → resuelto 2026-06-06 (migración + API + UI + sesión)
- [x] FB-2 contraste títulos done-screen → resuelto 2026-06-06
