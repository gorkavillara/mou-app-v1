# 12 — Convención angular (IA-01)

> Documento técnico de referencia para [[05-Tareas-IA#IA-01]] y [[10-Algoritmo-IA-normalizacion]].
> **Estado 2026-09-09**: MCP/PIP/DIP ya están calibrados contra **goniómetro real** (fotos del cirujano, ver sección "Calibración goniométrica 2026-09-09"). Sigue **sin medir**: más puntos de MCP, la hiperextensión (`clinicalMin`) y la **muñeca**.

## Resumen
Para cada articulación medible, fijamos:
1. La **posición de referencia** (cuándo es 0°).
2. El **rango clínico esperado** (de 0° a X°).
3. El **vector que se calcula** sobre los landmarks de MediaPipe.
4. El **signo** (flexión + / extensión −), anclado a la **anatomía** vía handedness — no a la imagen (ver siguiente sección).
5. El **rango medido empíricamente** (lo que devuelve la cámara antes de normalizar).

## Convención de signo: anclada a la anatomía, no a la imagen (2026-09-09)

> Ver decisión [[02-Decisiones-clave#D17]] y tarea [[13-Tablero|IA-18]].

**El bug (grave, silencioso, ya corregido).** `calculateJointAngles` fija el signo flexión(+)/extensión(−) con el producto vectorial 2D `a.x·b.y − a.y·b.x`. Ese producto mide el **sentido de giro en el espacio de la imagen**, no en anatomía: se **invierte cuando la mano proyectada se refleja**, es decir cuando el paciente enseña el otro lado de la mano a la cámara o usa la otra mano.

**Evidencia experimental (Gorka, 2026-09-09).** Se cogieron las 15 fotos de goniómetro del cirujano, se **espejaron horizontalmente** y se volvió a pasar el mismo pipeline:
- Se invirtió el signo de **las 15** lecturas, manteniendo las magnitudes. Ejemplos: índice MCP a 90° de goniómetro pasó de **−75,2° a +72,2°**; índice PIP a 90° pasó de **−71,3° a +76,6°**.
- La etiqueta de **handedness** de MediaPipe se invirtió (`Right`→`Left`) en **14 de las 15** fotos. El único fallo fue un **puño cerrado**, la pose más difícil de clasificar.

**Impacto en producción.** Con una calibración capturada en una quiralidad, un paciente que presentara la contraria daba **flexión negativa en todo el rango**, y `normalizeJointAngle` le clavaba un puño completo en `clinicalMin` (**−30°**) en lugar de ~90°. Es una explicación de peso de por qué el cirujano no se fiaba de los números.

**El arreglo (ya en código).** El signo pasa a ser `sign(cross2D) · parity(handedness)`, que es **invariante al espejo Y a mano izquierda/derecha** porque ambos factores se invierten a la vez. En `src/lib/hand-tracking.ts`:
- tipo `HandChirality` (`'Left' | 'Right'`, la **paridad de espejo tal como aparece en el frame**, no "qué mano del paciente es");
- `flexionSignFor(chirality)` → `−1` para `'Right'`, `+1` en el resto (anclado empíricamente en el set de goniómetro);
- `calculateJointAngles(landmarks, finger, chirality?)` y `calculateAllJointAngles(landmarks, chirality?)`.

En la sesión del paciente la quiralidad se usa **suavizada a nivel de sesión, no por frame**, precisamente porque la clasificación por frame falla de vez en cuando (el puño cerrado del experimento).

⚠️ **Consecuencia para la calibración antigua**: la captura de 2026-06-06 (MCP 12,3 / 98,8) se tomó en la **quiralidad opuesta**, por lo que su `measuredOpen` del MCP tenía el signo cambiado. **Queda invalidada** y ha sido sustituida (ver tabla).

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
> ✅ **Superado el 2026-09-09**: la recalibración goniométrica ya está hecha (ver sección siguiente). Los valores 12,3° / 98,8° de la captura 2026-06-06 quedan **invalidados** — además de promediar dedos y no tener goniómetro, se capturaron en la **quiralidad opuesta** (signo del `measuredOpen` cambiado). Lo que sigue pendiente del MCP son **más puntos de captura**, no la geometría.

### PIP (interfalángica proximal) — articulación media
- **0°**: Falange media en línea con proximal.
- **Flexión completa**: ~**100°** (rango clínico mayor que MCP).
- **Extensión / hiperextensión**: hasta **−30°** (BUG-4, feedback 2026-05-20).
- **Vector A**: MCP → PIP.
- **Vector B**: PIP → DIP.
- **Convención de signo**: positivo = flexión, negativo = extensión/hiperextensión (mismo cross-product 2D que MCP, **corregido por quiralidad** desde 2026-09-09).

### DIP (interfalángica distal) — punta
- **0°**: Falange distal en línea con media.
- **Flexión completa**: ~**80°**.
- **Extensión / hiperextensión**: hasta **−30°** (BUG-4, feedback 2026-05-20).
- **Vector A**: PIP → DIP.
- **Vector B**: DIP → TIP.
- **Convención de signo**: positivo = flexión, negativo = extensión/hiperextensión (**corregido por quiralidad** desde 2026-09-09).

> **Nota 2026-05-20 (BUG-4):** Javi opera tendones extensores y reportó *"NO MARCA LA EXTENSIÓN DE LAS INTERFALÁNGICAS"*. Hasta esa fecha PIP/DIP devolvían solo magnitud (≥ 0) y `clinicalMin` no existía, así que el déficit de extensión (dedo que no llega a 0°) y la hiperextensión leve se aplanaban a 0. Ahora PIP/DIP llevan signo y tienen `clinicalMin: -30`, de modo que la región negativa se resuelve en lugar de descartarse. El valor −30° es provisional, pendiente de goniómetro con Javi.

### Pulgar (out of scope Fase 1)
El pulgar tiene cinemática distinta (oposición, abducción, MP+IP solo). Lo dejamos fuera de las prescripciones iniciales hasta que un caso real lo justifique.

> ⚠️ **Trampa de nomenclatura (hallazgo 2026-09-09).** En `FINGERS` el pulgar se indexa `mcpIndex: 1, pipIndex: 2, dipIndex: 3, tipIndex: 4`. Como el pulgar **sólo tiene 2 falanges**, los nombres del lib **NO coinciden con la nomenclatura clínica**:
>
> | Nombre en el lib | Articulación real del pulgar |
> |---|---|
> | "MCP" | **CMC** (trapeciometacarpiana) |
> | "PIP" | **MP** (metacarpofalángica) — la "MP" del cirujano |
> | "DIP" | **IP** (interfalángica) |
>
> Nomenclatura estándar que nos dio el cirujano: **MP** (metacarpofalángica), **PIP** (interfalángica proximal), **DIP** (interfalángica distal); **el pulgar sólo tiene MP e IP**.
>
> El pulgar está **fuera de alcance de Fase 1** y **no entra en el ajuste** de calibración (sus lecturas del set de fotos se reportan sólo como informativas). Si en Fase 2 se mete el pulgar, hay que **renombrar o mapear explícitamente** esas articulaciones antes de enseñar ningún número al cirujano.

## Calibración goniométrica 2026-09-09 (cierra OPS-1 parcialmente)

El cirujano mandó por WhatsApp un set de **15 fotos** con el ángulo real medido con **goniómetro físico**: índice (2º dedo) **MCP / PIP / DIP a 0° / 45° / 90°** cada una, y pulgar **MP a 0/45/55** e **IP a 0/45/80**. Están commiteadas en:
- `docs/mou-dev/calibration/photos/` — las fotos,
- `docs/mou-dev/calibration/photos.json` — el manifiesto (fichero, dedo, articulación, ángulo clínico, caption),
- `docs/mou-dev/calibration/calibration-report.json` — el informe completo (crudos, handedness, landmarks y ajustes),
- `docs/mou-dev/calibration/README.md` — cómo re-ejecutarlo y cómo añadir fotos.

**Reproducible** con `npx tsx scripts/calibrate-from-photos.ts` (acepta `--dir <ruta>` para otro set y `--json <fichero>`). El script levanta `scripts/calibration/photo-landmarks.html`, corre **el mismo MediaPipe de la app en modo IMAGE** sobre cada foto, lee el ángulo con **la misma `calculateJointAngles` del producto** y ajusta por mínimos cuadrados `clinical = m·raw + b`, invirtiendo la recta para sacar el par `measuredOpen` / `measuredClosed`.

### Resultados del ajuste (valores ya aplicados en `JOINT_CALIBRATION`)

| Articulación | measuredOpen | measuredClosed | clinicalMax | R² | error medio | error máx |
|---|---|---|---|---|---|---|
| MCP | −11,8 | 88 | 90 | 0,909 | 10,0° | 14,9° |
| PIP | −1,3 | 76,8 | 100 | 0,976 | 5,3° | 7,9° |
| DIP | −8 | 52,9 | 80 | 0,994 | 2,7° | 4,1° |

Sustituyen a los anteriores (**MCP 12,3 / 98,8 · PIP −5,7 / 81,4 · DIP −5,6 / 71,9**, captura 2026-06-06 sin goniómetro y promediando dedos, además tomada en la **quiralidad opuesta**).

### Caveats (no suavizar — esto decide si nos fiamos de los números)
- **Sólo 3 puntos por articulación**, **un dedo** (índice), **un único sujeto** (una sola mano sana), y sobre **recortes comprimidos de WhatsApp**.
- El gate clínico del vault (error medio ≤ 10°, máx ≤ 15°) lo pasan **PIP y DIP con holgura**; el **MCP lo pasa raspando** (10,0 / 14,9). La lectura 2D del MCP **satura por encima de ~45° de flexión** porque la falange proximal se escorza y el nudillo se ocluye con el puño cerrado. **Faltan más puntos de captura del MCP → OPS-1 NO se cierra del todo.**
- **El MCP es sensible al encuadre, no sólo a la postura** (medido el 2026-09-09 al montar el E2E de medición): renderizando el set a 960×720, `indice-MCP-000` y `indice-DIP-000` son **la misma postura nominal de 0°** y el MCP normalizado sale **26,3°** en la primera y **3,5°** en la segunda — **~22° de diferencia** entre dos fotos del mismo 0°. Es coherente con que el MCP sea el ajuste más flojo, y es un argumento fuerte para no fiarse de una lectura puntual del MCP sin repetir postura. PIP y DIP no muestran esa dispersión.
- El **`clinicalMin` de −30° sigue SIN medir**: no hay ninguna pose de hiperextensión en el set de fotos.
- La **muñeca sigue sin calibrar**: la herramienta no mide muñeca (no hay antebrazo virtual cableado; `calculateWristAngle` devuelve 0 sin él).
- El **pulgar no entra en el ajuste**: sus lecturas son informativas y su nomenclatura en el lib no es la clínica (ver nota del pulgar más arriba).

## Tabla rápida de calibración

| Articulación | 0° clínico | Tope clínico | Medido empírico (abierto / cerrado) | Calidad del ajuste | Hiperext. |
|---|---|---|---|---|---|
| wrist | mano recta | +90° flex / −70° ext | _placeholder 15 / 95 — **PENDIENTE**, la herramienta aún no mide muñeca_ | — | sí |
| MCP (índice/medio/anular/meñique) | dedo recto | 90° / −30° ext | **−11,8 / 88** (goniómetro 2026-09-09) | R² 0,909 · medio 10,0° · máx 14,9° — ⚠️ **pasa el gate raspando**, faltan más puntos | leve (−30° **sin medir**) |
| PIP | falange media recta | 100° / −30° ext | **−1,3 / 76,8** (goniómetro 2026-09-09) | R² 0,976 · medio 5,3° · máx 7,9° ✅ | sí (−30° **sin medir**, BUG-4 2026-05-20) |
| DIP | falange distal recta | 80° / −30° ext | **−8 / 52,9** (goniómetro 2026-09-09) | R² 0,994 · medio 2,7° · máx 4,1° ✅ | sí (−30° **sin medir**, BUG-4 2026-05-20) |

> **Qué sigue pendiente**: (1) **más puntos de captura del MCP** (y a ser posible más dedos/sujetos) porque su lectura 2D satura por encima de ~45°; (2) la **hiperextensión** (`clinicalMin −30°`), que no tiene ninguna pose medida; (3) la **muñeca**, sin calibrar y con placeholder 15/95. Todo lo demás (MCP/PIP/DIP en flexión) ya tiene referencia de goniómetro real.

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

> **Estado 2026-09-09 del gate goniométrico**: cubierto con **3 posiciones por articulación** (no 10) y un solo dedo/sujeto. **PIP** (5,3 / 7,9) y **DIP** (2,7 / 4,1) lo pasan con holgura; **MCP** (10,0 / 14,9) lo pasa **al límite**. Con esa muestra el gate **no puede darse por superado**: falta repetir con más posiciones, más dedos y más de un sujeto antes del piloto (ver backlog en [[13-Tablero]]).

## Casos límite documentados
- **Oclusión entre dedos**: si MediaPipe pierde el landmark, marcar `quality_flag: low_visibility` y excluir esa rep de la media (no del recuento).
- **Mano lateral a cámara**: la proyección 2D distorsiona; el sistema asume mano frontal a la cámara. Documentar en instrucciones al paciente.
- **Anillo / vendaje**: validar empíricamente; si afecta a > 5° detectado, documentar como limitación.
- **Mano izquierda vs derecha / mano espejada**: MediaPipe devuelve `handedness`, y desde 2026-09-09 ese dato **no es sólo informativo**: es lo que ancla el signo de flexión a la anatomía (ver sección de convención de signo). Se sigue avisando si no coincide con la mano operada, pero además la sesión mantiene una quiralidad **suavizada a nivel de sesión** porque la clasificación por frame falla puntualmente (típicamente con el puño cerrado).
