# Mou – Plataforma de Rehabilitación de Mano

Mou es una aplicación web de rehabilitación de mano que utiliza **MediaPipe Hand Landmarker** para hacer seguimiento en tiempo real de los dedos del paciente a través de la cámara del dispositivo, sin necesidad de hardware adicional.

## ¿Qué hace?

- **Detección de la mano en tiempo real** a 30+ fps mediante la cámara frontal (escritorio y móvil).
- **Seguimiento de ángulos de flexo-extensión** por dedo (MCP joint): detecta si el paciente está flexionando o extendiendo correctamente.
- **Conteo automático de repeticiones** usando una media deslizante de 10 frames y umbral de ±15°.
- **Métricas por sesión**: ROM (rango de movimiento), flexión máxima, extensión máxima, repeticiones completadas y tiempo transcurrido.
- **Estado por dedo**: cada dedo puede marcarse como normal, lesionado (se rastrea y muestra el ángulo en pantalla) o amputado (se excluye del tracking).
- **Panel de doctor**: vista de pacientes, alertas de adherencia e informes exportables a PDF.
- **Visualización médica de precisión**: esqueleto de la mano dibujado en canvas con líneas finas cian y re-mapeo de coordenadas para alineación exacta en cualquier resolución y ratio de aspecto.

## Ejercicios disponibles

| ID | Nombre | Descripción |
|----|--------|-------------|
| `MP_IP_BLOCKED` | FE activa MP con IP bloqueadas | Flexoextensión metacarpofalángica con interfalángicas bloqueadas |
| `FINGERS_NO_IP_BLOCK` | FE activa de dedos sin bloqueo de IP | Cierre completo de puño con extensión total |

## Tech Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Lenguaje | TypeScript 5 (strict) |
| UI | Tailwind CSS 4, Framer Motion, Lucide icons |
| Tracking | @mediapipe/tasks-vision – Hand Landmarker float16 |
| Gráficas | Recharts 3 |
| PDF | jsPDF |

## Estructura del proyecto

```
src/
  app/
    exercises/page.tsx    # Sesión de ejercicio: cámara + tracking + métricas
    dashboard/page.tsx    # Dashboard del paciente
    doctor/               # Panel médico (lista de pacientes, detalle)
    report/page.tsx       # Informe de rehabilitación con exportación PDF
    profile/page.tsx      # Perfil del paciente
    login/page.tsx        # Login (prototipo con datos hardcodeados)
  components/
    exercises/            # MetricsGrid, ExerciseDemo, FingerSelector, DashboardHeader
    dashboard/            # Tarjetas IFRM, Adherencia, Calidad, Progreso
    report/               # Secciones del informe PDF
  lib/
    hand-tracking.ts      # Cálculo de ángulos, dibujo del esqueleto, conteo de reps
  data/
    exercises.ts          # Definición de ejercicios
    patients.ts           # Base de datos mock de pacientes
```

## Comandos

```bash
npm run dev      # Servidor de desarrollo (Turbopack)
npm run build    # Build de producción
npm run lint     # ESLint
```

## Arquitectura de tracking

- **21 landmarks** por mano (MediaPipe Hand Landmarker).
- El ángulo de cada dedo se mide entre los vectores `wrist→MCP` y `MCP→PIP` en 3D.
- Las coordenadas normalizadas de MediaPipe se re-mapean al canvas mediante la transformación `object-fit: cover` del vídeo, garantizando alineación exacta en cualquier dispositivo.
- El canvas interno se dimensiona dinámicamente al tamaño de visualización del contenedor (sin escalado CSS adicional).
- Los dedos lesionados se priorizan para el cálculo del ángulo representativo de la sesión.
