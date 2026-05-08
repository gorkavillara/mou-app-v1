# 10 — Normalización del algoritmo IA

> Detalle técnico de [[05-Tareas-IA]]. Resumen del problema y enfoque, para que cualquiera que coja la tarea pueda empezar.

## El problema (citado)

> *"Fíjate que está en extensión completa pero marca 20. Cuando coge algo detrás ahí tiene que ser 90. Y luego cuando estiro pone 30, 30, 20, 20… para arriba son 20 de extensión pero 20 de tensión no es. Hay que normalizarlo de alguna manera."*

Síntomas:
1. **Mano abierta no marca 0°.** Marca un valor base (~20°) por la geometría de los landmarks.
2. **Flexión completa no llega a 90°.** Depende de la posición de la cámara y de cómo se tomen los vectores.
3. **No distingue articulaciones.** Hoy se calcula un único ángulo por dedo.

## Enfoque

### Paso 1 — Calcular ángulos por articulación
Por cada dedo (índice, medio, anular, meñique), 3 ángulos:

```ts
type FingerLandmarks = {
  mcp: Point3D;  // landmark 5/9/13/17
  pip: Point3D;  // landmark 6/10/14/18
  dip: Point3D;  // landmark 7/11/15/19
  tip: Point3D;  // landmark 8/12/16/20
};

function fingerAngles(wrist: Point3D, finger: FingerLandmarks) {
  return {
    mcp: angleBetween(vec(wrist, finger.mcp), vec(finger.mcp, finger.pip)),
    pip: angleBetween(vec(finger.mcp, finger.pip), vec(finger.pip, finger.dip)),
    dip: angleBetween(vec(finger.pip, finger.dip), vec(finger.dip, finger.tip)),
  };
}
```

### Paso 2 — Calibración por convención
Después de validar empíricamente con Javi:

```ts
const CALIBRATION = {
  mcp: { measured_open: 12, measured_closed: 100, clinical_max: 90 },
  pip: { measured_open: 10, measured_closed: 110, clinical_max: 100 },
  dip: { measured_open: 8,  measured_closed: 95,  clinical_max: 80 },
  wrist: { measured_open: 15, measured_closed: 95, clinical_max: 90 },
};

function normalize(measuredDeg: number, joint: keyof typeof CALIBRATION) {
  const c = CALIBRATION[joint];
  const range = c.measured_closed - c.measured_open;
  const clamped = Math.max(c.measured_open, Math.min(c.measured_closed, measuredDeg));
  return ((clamped - c.measured_open) / range) * c.clinical_max;
}
```

> **Importante**: los valores `measured_*` se obtienen empíricamente con la herramienta IA-04 antes del piloto. **No inventarlos**.

### Paso 3 — Per-frame vs per-rep
- Por **frame**: ángulo crudo + ángulo normalizado.
- Por **rep**: máximo y mínimo del normalizado durante la rep. Es lo que se persiste en `rep_measurements`.

### Paso 4 — Conteo de reps
Sigue siendo sliding window, pero **sobre el ángulo normalizado**, no el crudo. El threshold pasa de ±15° crudo a ±15° normalizado.

## Validación

### Antes de creer en los datos
1. Test cara a cara: Javi mide con goniómetro real, sistema mide con cámara, comparar 10 posiciones.
2. Margen aceptable: ±10° entre los dos. Si es peor, recalibrar.
3. Repetir test en 3 condiciones de iluminación y 2 distancias de cámara.

### Casos límite a documentar
- Mano oclusiva (dedos detrás de otros).
- Cámara mal colocada (lateral en vez de frontal).
- Mano izquierda vs derecha (handedness).
- Anillos / vendajes.

## Plan B si la calibración global falla
Calibración personal:
1. Primera sesión del paciente: "Pon la mano abierta sobre la mesa" → captura `measured_open`.
2. "Cierra el puño" → captura `measured_closed`.
3. Guardar ambos valores en `patients` y normalizar contra ellos para futuras sesiones.

Trade-off: requiere un onboarding extra de 30s, pero los datos serán mucho más fiables.
