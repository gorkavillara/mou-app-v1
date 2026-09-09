# Calibración goniométrica (fotos)

> Carpeta de datos de la calibración **goniómetro-referenciada** de `JOINT_CALIBRATION`
> (`src/lib/hand-tracking.ts`). Contexto y caveats clínicos en [[12-Convencion-angular]];
> decisiones en [[02-Decisiones-clave#D16]] y [[02-Decisiones-clave#D17]]; tareas
> [[13-Tablero|IA-19]] y [[13-Tablero|OPS-1]].

## Qué hay aquí

| Fichero | Qué es |
|---|---|
| `photos/` | Las **15 fotos** del set: índice (2º dedo) **MCP / PIP / DIP a 0° / 45° / 90°**, y pulgar **MP a 0/45/55** e **IP a 0/45/80**. |
| `photos.json` | **Manifiesto**: por cada foto, el dedo, la articulación, el **ángulo real medido con goniómetro físico** (`clinical`), el caption original y las dimensiones. |
| `calibration-report.json` | **Informe completo** generado por el script: crudo leído por la cámara para cada foto, `handedness` detectada, los 21 landmarks de cada foto y los ajustes (`m`, `b`, R², residuos, error medio/máx, `measuredOpen`/`measuredClosed`). |
| `overlays/` (opcional, se genera bajo demanda) | Una imagen por foto con los dos segmentos óseos, el arco del vértice y los números dibujados encima — evidencia visual de **dónde** mide la herramienta. Se genera con `--overlays`. |

## De dónde salen las fotos

Las mandó **el cirujano (Javi) por WhatsApp el 2026-09-09**: cada foto es una postura de la
mano cuyo ángulo **real** se midió con un **goniómetro físico** antes de disparar. Ese ángulo
es el que aparece en el caption y en el campo `clinical` del manifiesto: es la **verdad de
referencia** contra la que se ajusta la lectura de la cámara.

⚠️ **Son recortes comprimidos de WhatsApp**, de **un solo sujeto** (una única mano sana), **un solo dedo**
(índice) y **3 puntos por articulación**. No es una muestra suficiente para dar la calibración
por buena: ver los caveats en [[12-Convencion-angular]] y la tarea [[13-Tablero|IA-21]].

## Cómo re-ejecutar el ajuste

```bash
npx tsx scripts/calibrate-from-photos.ts
```

Qué hace, en orden:

1. Levanta un servidor local con `scripts/calibration/photo-landmarks.html`.
2. Corre **el mismo MediaPipe de la app**, en modo **IMAGE**, sobre cada foto de `photos/`.
3. Lee el ángulo con **la misma `calculateJointAngles` del producto** (pasándole la
   **quiralidad** detectada — sin eso el signo dependería de cómo se presentó la mano al
   objetivo y no de la anatomía, ver [[02-Decisiones-clave#D17]]).
4. Ajusta por **mínimos cuadrados** `clinical = m·raw + b` por articulación y **invierte la
   recta** para sacar el par que necesita `JOINT_CALIBRATION`:
   `measuredOpen = (0 − b)/m` y `measuredClosed = (clinicalMax − b)/m`.
5. Imprime por consola el bloque listo para pegar en `JOINT_CALIBRATION` y escribe
   `calibration-report.json`.

Como la geometría sale de la función de producción, **el ajuste no puede desviarse de lo que
mide la app**.

### Opciones

| Flag | Para qué |
|---|---|
| `--dir <ruta>` | Usa **otro set de fotos** (misma estructura: carpeta con `photos.json` + `photos/`). |
| `--json <fichero>` | Escribe el informe en otra ruta (por defecto, `calibration-report.json` dentro del set). |
| `--overlays` | Genera `overlays/` con lo medido dibujado sobre cada foto (evidencia para el cirujano). |

### Requisitos

- **Red**: el wasm y el modelo de MediaPipe se descargan de los mismos CDNs que la app.
- **Chromium de Playwright**: `npx playwright install chromium` (usa el mismo build que la suite e2e).

## Cómo añadir fotos nuevas al manifiesto

1. Copia la imagen a `photos/` con el patrón `<dedo>-<articulación>-<ángulo con 3 dígitos>.png`
   (p. ej. `indice-MCP-030.png`). El nombre es sólo convención, lo que manda es el manifiesto.
2. Añade una entrada a `photos.json`:

```json
{
  "file": "indice-MCP-030.png",
  "finger": "indice",
  "joint": "MCP",
  "clinical": 30,
  "caption": "2º dedo MP 30º",
  "width": 330,
  "height": 260
}
```

- `finger`: nombre del dedo tal como está en `FINGERS` (`pulgar`, `indice`, `medio`, `anular`, `menique` — sin tilde ni eñe).
- `joint`: `MCP` / `PIP` / `DIP` para los dedos largos. Para el **pulgar** se usa la nomenclatura
  del cirujano (`MP`, `IP`) y el script la mapea a los índices del lib.
- `clinical`: el ángulo **medido con goniómetro**, en grados. Sin goniómetro **no se añade la foto**:
  el punto no sirve como referencia.

3. Vuelve a lanzar el script y **pega el bloque impreso** en `JOINT_CALIBRATION`
   (`src/lib/hand-tracking.ts`), junto con R², error medio y error máximo en el comentario.
4. Actualiza la tabla de [[12-Convencion-angular]] y deja constancia en [[13-Tablero]].

> ⚠️ **Nomenclatura del pulgar**: en `FINGERS` el "MCP" del pulgar es en realidad la **CMC**,
> su "PIP" es la **MP** clínica y su "DIP" es la **IP**. El pulgar está fuera de alcance de
> Fase 1 y **no entra en el ajuste** (sus lecturas se reportan sólo como informativas).
> Ver [[12-Convencion-angular]] y [[13-Tablero|IA-20]].

## Qué NO cubre este set

- **Hiperextensión**: no hay ninguna pose, así que el `clinicalMin` de −30° **sigue sin medir**.
- **Muñeca**: la herramienta no la mide (no hay antebrazo virtual cableado; `calculateWristAngle`
  devuelve 0 sin él). Su calibración sigue siendo un placeholder.
- **MCP por encima de ~45°**: la lectura 2D satura porque la falange proximal se escorza y el
  nudillo se ocluye con el puño cerrado. Es lo que deja el ajuste del MCP al límite del gate
  clínico (error medio 10,0°, máximo 14,9°) y por lo que [[13-Tablero|OPS-1]] **no está cerrada**.
