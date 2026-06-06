# 05 — Tareas IA / Computer Vision

> Este es el bloque **bloqueante de venta**. Si los grados no son creíbles, la mutua no compra. [[02-Decisiones-clave#D10]] y [[02-Decisiones-clave#D11]].
> Convenciones: `[P0]` bloqueante para piloto · `[P1]` necesario antes de mutua · `[P2]` deseable.

## P0 — Normalización del rango angular

### IA-01 [P0] Definir convención angular por articulación
Documento técnico que fija para cada articulación medible:
- **Wrist (muñeca)**: 0° = mano alineada con antebrazo (extensión neutra). 90° = flexión completa palmar. -70° = extensión dorsal completa.
- **MCP (metacarpofalángica)**: 0° = dedo en extensión completa, en línea con metacarpiano. 90° = flexión a palma.
- **PIP (interfalángica proximal)**: 0° = falange media en línea con proximal. ~100° = flexión completa.
- **DIP (interfalángica distal)**: 0° = falange distal en línea con media. ~80° = flexión completa.

Validar con Javi en consulta — él tiene goniómetro y nos puede confirmar. **Sin esta validación el resto del trabajo es ciego.**

### IA-02 [P0] Refactor de `src/lib/hand-tracking.ts` para devolver ángulos por articulación
Actual: calcula un ángulo "de dedo" entre wrist→MCP y MCP→TIP.
Nuevo: para cada dedo, devolver `{ MCP: deg, PIP: deg, DIP: deg }` calculados con vectores entre landmarks consecutivos:
- `MCP angle = angleBetween(wrist→MCP, MCP→PIP)`
- `PIP angle = angleBetween(MCP→PIP, PIP→DIP)`
- `DIP angle = angleBetween(PIP→DIP, DIP→TIP)`

### IA-03 [P0] Mapeo del rango medido al rango clínico (0–90°)
Después de calcular, **normalizar** al rango clínico esperado:
- Calibrar contra dos posiciones de referencia: mano abierta (debería dar 0°) y puño cerrado (debería dar ~90° en MCP, ~100° PIP, ~80° DIP).
- Definir transformación: si `medido_abierto = 12°` y `medido_cerrado = 105°`, aplicar `f(x) = (x - 12) / (105 - 12) * 90` para wrist y similar por articulación con sus valores.
- Guardar la calibración por usuario si hace falta. **Plan A**: calibración global fija basada en valores empíricos. **Plan B** (si el A falla): pedir al paciente "abre la mano" y "cierra el puño" en la primera sesión y registrar sus extremos.

### IA-04 [P0] Tests visuales de cordura
Crear página oculta `/dev/calibration` solo en desarrollo:
- Cámara en vivo.
- Junto al canvas, lista en tiempo real de ángulos de cada articulación.
- Captura de "frame ground truth": pulsas un botón con la mano en posición conocida (recta sobre la mesa), guarda el frame + landmarks + ángulos calculados → para revisar errores.

## P0 — Conteo de repeticiones robusto

### IA-05 [P0] Revisar conteo actual
Hoy: ventana deslizante 10 frames, threshold ±15°. Validar que sigue funcionando bien con los nuevos ángulos por articulación.
- Definir cuál articulación dispara la cuenta por ejercicio:
  - *Flexión pasiva dedos* → MCP de medio/anular.
  - *Extensión activa dedos* → MCP de los 4 dedos largos.

### IA-06 [P0] Filtrado de mediciones inválidas
Cuando MediaPipe pierde la mano, los ángulos pueden saltar. Marcar como `quality_flag: low_visibility` cualquier rep cuyo cálculo durante > 30% del tiempo tuvo confianza < 0.7. No descartarlas — guardarlas marcadas, para no inflar adherencia con basura.

## P1 — UX clínica

### IA-07 [P1] Animación guía de mano dibujada
Producir 2 animaciones (Lottie o GIF):
- Flexión pasiva de dedos: mano abierta → puño con la otra mano ayudando.
- Extensión activa de dedos: dedos doblados → estirados activamente.

Estilo: línea limpia, sin realismo. Anatómicamente correcta para que se entienda.
- *Esto es trabajo de diseño/animación, no de código.* Considerar: contratar freelance, generar con AI (Sora / Runway), o usar plantillas de LottieFiles.

### IA-08 [P1] Indicador en vivo de ángulo
Mostrar en pantalla durante el ejercicio el ángulo actual y el pico de la rep en curso. Útil para que el paciente "haga progreso visible".

### IA-09 [P1] Detección de "ejercicio mal hecho"
Si el paciente no llega al rango mínimo en 3 reps consecutivas, pop-up: *"Intenta llegar más lejos. Está bien si te ayudas con la otra mano."*
- Cuidado de no ser molesto: solo en flexión pasiva (donde la ayuda es la indicación).

## P2 — Avanzado

### IA-10 [P2] Estimación de calidad de movimiento
Más allá del rango: velocidad angular, suavidad, simetría entre dedos. Métricas extra que pueden venderse a la mutua como "fisioterapia digital, no solo conteo".

### IA-11 [P2] Detección de mano correcta
Si el paciente tiene operada la izquierda y enseña la derecha, avisar. MediaPipe ya devuelve handedness.

### IA-12 [P2] Modo "espejo" para autovalidación
*"Es como si yo tuviese un espejo delante de él que le va diciendo si bien o mal"* — funcionalidad ambiciosa, puede esperar.
