# 12 — Convención angular (IA-01)

> Documento técnico de referencia para [[05-Tareas-IA#IA-01]] y [[10-Algoritmo-IA-normalizacion]].
> **Antes de creer en cualquier número del sistema, validar estas convenciones con goniómetro real en consulta con Miguel.**

## Resumen
Para cada articulación medible, fijamos:
1. La **posición de referencia** (cuándo es 0°).
2. El **rango clínico esperado** (de 0° a X°).
3. El **vector que se calcula** sobre los landmarks de MediaPipe.
4. El **rango medido empíricamente** (lo que devuelve la cámara antes de normalizar — pendiente de calibración con Miguel).

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
- **Vector A**: wrist → MCP del dedo (landmarks 0→{5,9,13,17}).
- **Vector B**: MCP → PIP del mismo dedo ({5,9,13,17}→{6,10,14,18}).

### PIP (interfalángica proximal) — articulación media
- **0°**: Falange media en línea con proximal.
- **Flexión completa**: ~**100°** (rango clínico mayor que MCP).
- **Extensión**: 0° (no hiperextiende sano).
- **Vector A**: MCP → PIP.
- **Vector B**: PIP → DIP.

### DIP (interfalángica distal) — punta
- **0°**: Falange distal en línea con media.
- **Flexión completa**: ~**80°**.
- **Extensión**: 0°.
- **Vector A**: PIP → DIP.
- **Vector B**: DIP → TIP.

### Pulgar (out of scope Fase 1)
El pulgar tiene cinemática distinta (oposición, abducción, MCP+IP solo). Lo dejamos fuera de las prescripciones iniciales hasta que un caso real lo justifique.

## Tabla rápida de calibración

| Articulación | 0° clínico | Tope clínico | Medido empírico (TBD) | Hiperext. |
|---|---|---|---|---|
| wrist | mano recta | +90° flex / −70° ext | _pendiente_ | sí |
| MCP (índice/medio/anular/meñique) | dedo recto | 90° | _pendiente_ | leve |
| PIP | falange media recta | 100° | _pendiente_ | no |
| DIP | falange distal recta | 80° | _pendiente_ | no |

> Los valores **medido empírico** se rellenan en sesión presencial con Miguel + goniómetro + la herramienta `/dev/calibration` (IA-04). No usar la app en producción hasta que esta tabla esté completa.

## Algoritmo de normalización

```
clinical_deg = (measured_deg − measured_open) / (measured_closed − measured_open) × clinical_max
```

Con `clamp` a [0, clinical_max].

Para articulaciones con hiperextensión (wrist, MCP), aplicar la fórmula en dos tramos: uno por encima de 0 (flexión) y otro por debajo (extensión), con `measured_open` como punto de pivote.

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
