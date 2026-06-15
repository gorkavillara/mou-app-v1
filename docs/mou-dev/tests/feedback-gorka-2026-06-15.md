# Feedback Gorka — 2026-06-15 (goniómetro por dedo)

Contexto: ronda de feedback con el dueño (Gorka) sobre el goniómetro. Decisiones cerradas; **todavía no implementadas** (la implementación va en otra tanda). Se etiqueta como **FB-3**. Ver [[../02-Decisiones-clave#D14]].

## Diagnóstico — qué mide hoy

- Cuando hay **varios dedos afectados**, el goniómetro **promedia** el ángulo MCP de todos ellos en un único número, tanto en la cámara como en lo que se persiste: `rep_measurements` guarda **un valor por articulación promediado entre dedos**.
- Clínicamente es **incorrecto**: dos dedos afectados con ROM distinto no se pueden promediar.
- Además la selección de dedos afectados es **opcional**: si no se marca ninguno, se promedia el MCP de los **4 dedos largos**, mezclando sanos y afectados.
- Las etiquetas por-dedo del canvas ya existen, pero están alimentadas con `0` (placeholder muerto).

## Decisiones

### 1. Medición del MCP por dedo afectado, por separado

> El ángulo que importa es el metacarpofalángico, y de cada dedo lesionado, no la media.

- El ángulo clínicamente relevante es el **MCP** del dedo afectado.
- La cámara muestra el MCP de **cada** dedo lesionado **por separado** (no promediado).
- Revivir las etiquetas por-dedo del canvas con el **MCP normalizado real** (hoy en `0`).

### 2. Persistencia por dedo ("guardar por dedo, correcto")

- `rep_measurements` gana una dimensión **dedo**: nueva columna **`finger text`** (uno de `pulgar|indice|medio|anular|menique`; **nullable** para filas legacy sin dedo).
- Granularidad: de (rep × articulación) → (rep × articulación × **dedo**).
- `patient_progression` agrupa **también por dedo** y acepta un **filtro de dedo opcional**, de forma **retrocompatible** (filas con `finger NULL` agrupan como hoy).
- El panel del doctor muestra la progresión **por dedo** (cada dedo afectado, su propia serie de ROM).

### 3. Selección obligatoria de ≥1 dedo lesionado

- En el panel del doctor pasa a ser **obligatorio** marcar al menos un dedo lesionado, al **crear** y al **editar** paciente.
- Validación `injured_fingers.length >= 1`, reforzada en **backend** (Zod `createPatientSchema` / `patchPatientSchema`) y en **UI** (NewPatientDialog + FingerStatusControl).

### 4. Picker simplificado a N/L

- El selector de estado de dedos pasa de **N/L/A** (Normal/Lesionado/Amputado) a solo **N/L** (Normal/Lesionado). Se retira **Amputado** del UI.
- Los antiguos "amputados" se tratan como **lesionados**: se **miden** igual, ya no se excluyen.
- La columna `amputated_fingers` **permanece en la BD pero queda sin uso** (siempre vacía desde el UI); no se elimina, para no tocar esquema ni validaciones existentes.
- **Revierte parcialmente FB-1** (2026-06-06), que había introducido el estado Amputado. Se deja rastro explícito del cambio de criterio.

## Estado

- [x] B-20 migración `rep_measurements.finger` (nullable) + `amputated_fingers` deprecada → 2026-06-15
- [x] B-21 `patient_progression` agrupa por dedo (retrocompat `finger NULL`) → 2026-06-15
- [x] B-22 `POST sessions` acepta `finger` por medición (sin promediar) + CSV → 2026-06-15
- [x] B-23 validación `injured_fingers >= 1` en Zod (alta + edición) → 2026-06-15
- [x] B-24 (review) migración backfill `amputated_fingers → injured_fingers` (D14) → 2026-06-15
- [x] F-17 picker dedos N/L (retirado Amputado) → 2026-06-15
- [x] F-18 obligatorio ≥1 dedo lesionado (cliente + backend) → 2026-06-15
- [x] F-19 progresión angular por dedo + fix extensión nunca dibujada → 2026-06-15
- [x] IA-13 cámara: MCP por dedo afectado (HUD + etiquetas canvas) → 2026-06-15
- [x] IA-14 payload por `(rep × dedo × articulación)` + resumen `done` por dedo → 2026-06-15
- [x] PRIV-1 aviso "el vídeo no se graba" en la sesión del paciente → 2026-06-15
