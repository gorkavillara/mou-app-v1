# 12 — Convención angular (IA-01)

> Documento técnico de referencia para [[05-Tareas-IA#IA-01]] y [[10-Algoritmo-IA-normalizacion]].
> **Antes de creer en cualquier número del sistema, validar estas convenciones con goniómetro real en consulta con Javi.**

## Resumen
Para cada articulación medible, fijamos:
1. La **posición de referencia** (cuándo es 0°).
2. El **rango clínico esperado** (de 0° a X°).
3. El **vector que se calcula** sobre los landmarks de MediaPipe.
4. El **rango medido empíricamente** (lo que devuelve la cámara antes de normalizar — pendiente de calibración con Javi).

## Articulaciones cubiertas

### Muñeca (wrist)
- **0°**: Mano alineada con antebrazo, posición neutra.
- **Flexión palmar**: hasta **+90°**.
- **Extensión dorsal**: hasta **−70°**.
- **Vector A**: forearm → wrist (antebrazo virtual proyectado, ya implementado).
- **Vector B**: wrist → middleMCP (landmark 9).
- **Convención de signo**: positivo si el ángulo cae hacia palmar (la palma "se cierra" hacia el antebrazo).

### MCP (metacarpofalángica) — base del dedo
- **0°**: Falange proximal en línea con metacarpiano (dedo recto).
- **Flexión completa**: ~**90°** hacia palma.
- **Extensión**: ~**−30°** (hiperextensión clínica, raro fuera de pulgar).
- **Vector A**: wrist → MCP del dedo (landmarks 0→{5,9,13,17}) = **metacarpiano** (hueso de la mano).
- **Vector B**: MCP → PIP del mismo dedo ({5,9,13,17}→{6,10,14,18}) = **falange proximal** del dedo.

> **Nota 2026-06-15 (FB clínico Gorka/cirujano — calibración, no geometría):** el cirujano revisó las mediciones y los grados normalizados no eran fiables. Aclaración clínica clave: el ángulo a medir (por ahora, Fase 1) es el **MCP**, definido como el ángulo entre el **metacarpiano** (hueso de la mano) y la **falange proximal** del dedo afectado.
>
> **Diagnóstico**: la **geometría del lib ya mide ese ángulo correctamente**. `calculateJointAngles().MCP` usa el vector `muñeca (landmark 0) → nudillo MCP` (= metacarpiano) contra `nudillo MCP → PIP` (= falange proximal); es exactamente el MCP clínico. Lo que fallaba **no era el cálculo sino la CALIBRACIÓN**: los `measuredOpen`/`measuredClosed` de `JOINT_CALIBRATION.MCP` se capturaron **una sola vez con webcam, promediando entre los 4 dedos largos y SIN goniómetro real**, por eso los grados normalizados no cuadran con la clínica.
>
> **En curso (ver [[02-Decisiones-clave#D16]] y [[05-Tareas-IA#IA-17]])**: se rehace la interfaz `/dev/calibration` para medir el MCP **del dedo afectado/seleccionado** (sin promediar), **dibujar sobre el vídeo** el metacarpiano, la falange proximal y el arco del ángulo (transparencia para el cirujano), y hacer **captura multipunto goniómetro-referenciada** (≥2 puntos → ajuste lineal `clinical = m·raw + b` → se derivan `measuredOpen`/`measuredClosed`). Tras esto queda **PENDIENTE la recalibración real con datos del goniómetro** (la captura la harán Gorka/Javi; a Javi solo validación clínica).
>
> ⚠️ Hasta esa recalibración, los valores de `JOINT_CALIBRATION.MCP` (12.3° / 98.8°, captura 2026-06-06) están **marcados como PENDIENTES** y no deben creerse en producción.

### PIP (interfalángica proximal) — articulación media
- **0°**: Falange media en línea con proximal.
- **Flexión completa**: ~**100°** (rango clínico mayor que MCP).
- **Extensión / hiperextensión**: hasta **−30°** (BUG-4, feedback 2026-05-20).
- **Vector A**: MCP → PIP.
- **Vector B**: PIP → DIP.
- **Convención de signo**: positivo = flexión, negativo = extensión/hiperextensión (mismo cross-product 2D que MCP).

### DIP (interfalángica distal) — punta
- **0°**: Falange distal en línea con media.
- **Flexión completa**: ~**80°**.
- **Extensión / hiperextensión**: hasta **−30°** (BUG-4, feedback 2026-05-20).
- **Vector A**: PIP → DIP.
- **Vector B**: DIP → TIP.
- **Convención de signo**: positivo = flexión, negativo = extensión/hiperextensión.

> **Nota 2026-05-20 (BUG-4):** Javi opera tendones extensores y reportó *"NO MARCA LA EXTENSIÓN DE LAS INTERFALÁNGICAS"*. Hasta esa fecha PIP/DIP devolvían solo magnitud (≥ 0) y `clinicalMin` no existía, así que el déficit de extensión (dedo que no llega a 0°) y la hiperextensión leve se aplanaban a 0. Ahora PIP/DIP llevan signo y tienen `clinicalMin: -30`, de modo que la región negativa se resuelve en lugar de descartarse. El valor −30° es provisional, pendiente de goniómetro con Javi.

### Pulgar (out of scope Fase 1)
El pulgar tiene cinemática distinta (oposición, abducción, MCP+IP solo). Lo dejamos fuera de las prescripciones iniciales hasta que un caso real lo justifique.

## Tabla rápida de calibración

| Articulación | 0° clínico | Tope clínico | Medido empírico (abierto / cerrado) | Hiperext. |
|---|---|---|---|---|
| wrist | mano recta | +90° flex / −70° ext | _pendiente — la herramienta aún no mide muñeca_ | sí |
| MCP (índice/medio/anular/meñique) | dedo recto | 90° / −30° ext | 12.3° / 98.8° (2026-06-06) — ⚠️ **PENDIENTE recalibración goniómetro** (promediado entre dedos, sin goniómetro; ver nota 2026-06-15) | leve |
| PIP | falange media recta | 100° / −30° ext | −5.7° / 81.4° (2026-06-06) | sí (−30°, BUG-4 2026-05-20) |
| DIP | falange distal recta | 80° / −30° ext | −5.6° / 71.9° (2026-06-06) | sí (−30°, BUG-4 2026-05-20) |

> Los valores **medido empírico** de MCP/PIP/DIP provienen de la **captura técnica de Gorka (2026-06-06, webcam, mano de perfil); pendiente validación goniómetro (Javi)**. La muñeca sigue **pendiente — la herramienta `/dev/calibration` aún no mide muñeca** (no hay antebrazo virtual cableado allí; `calculateWristAngle` devuelve 0 sin él, ver `CalibrationView`). No usar la app en producción hasta que esta tabla esté validada clínicamente.

> **Nota 2026-06-06 (normalización con pendiente única):** PIP/DIP miden negativo con la mano abierta (−5.7° / −5.6°). La normalización pasó de dos tramos (uno positivo + una "banda negativa" que pivotaba sobre `−measuredOpen`) a **una sola recta** definida por los dos puntos de calibración (`measuredOpen → 0`, `measuredClosed → tope`). Una calibración de dos puntos tiene exactamente una pendiente; los `measuredOpen` negativos rompían la fórmula antigua. Por debajo de `measuredOpen` se extiende linealmente hacia la banda negativa hasta `clinicalMin`; si `measuredClosed − measuredOpen` no es un rango positivo finito, devuelve 0 (protege capturas degeneradas como la muñeca 0/0).
>
> ⚠️ **Efecto colateral en la muñeca (placeholder 15/95):** con la recta única, la banda de hiperextensión de muñeca cambió de escala — antes raw −15 ya mapeaba a −70 clínico (el tramo negativo tenía pendiente propia); ahora −70 solo se alcanza a raw ≈ −47 (misma pendiente que la flexión). Irrelevante hoy porque la muñeca no está calibrada empíricamente ni se usa como driver, pero tenerlo presente cuando se capture la muñeca de verdad.

## Algoritmo de normalización

```
clinical_deg = (measured_deg − measured_open) / (measured_closed − measured_open) × clinical_max
```

Con `clamp` a `[clinical_min ?? 0, clinical_max]`.

**2026-06-06 — pendiente única.** Es la misma recta para todo el rango: una calibración de dos puntos define exactamente una pendiente. No hay tramos separados ni pivote sobre `−measured_open` (la fórmula antigua se rompía cuando `measured_open` era negativo, como en PIP/DIP). Por debajo de `measured_open` la recta entra de forma natural en la banda negativa hasta `clinical_min` (0 para articulaciones sin hiperextensión). Si `measured_closed − measured_open` no es un rango positivo finito, la función devuelve 0.

## Validación clínica (gate antes del piloto)

| Test | Aceptación |
|---|---|
| Mano recta sobre la mesa | Cada articulación marca 0° ± 5° |
| Puño cerrado completo | MCP ≥ 80°, PIP ≥ 90°, DIP ≥ 70° |
| Muñeca flexionada al máximo | wrist ≥ 80° |
| Goniómetro vs cámara, 10 posiciones | Error medio ≤ 10°, máximo ≤ 15° |

Si no se cumple → recalibrar empíricos o pasar a calibración por paciente (Plan B en [[10-Algoritmo-IA-normalizacion]]).

## Casos límite documentados
- **Oclusión entre dedos**: si MediaPipe pierde el landmark, marcar `quality_flag: low_visibility` y excluir esa rep de la media (no del recuento).
- **Mano lateral a cámara**: la proyección 2D distorsiona; el sistema asume mano frontal a la cámara. Documentar en instrucciones al paciente.
- **Anillo / vendaje**: validar empíricamente; si afecta a > 5° detectado, documentar como limitación.
- **Mano izquierda vs derecha**: MediaPipe devuelve `handedness`. Confirmar que coincide con la mano operada del paciente; si no, avisar.
