# 11 — Riesgos y bloqueos

| # | Riesgo | Probab. | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | La normalización 0-90° no consigue ±10° de error | Media | Crítico — sin esto el dato no se vende | Plan B de calibración personal por paciente. Validar con Javi antes del 14-05. |
| R2 | El director médico bloquea el piloto por GDPR | Baja | Bloqueante | Doc legal preparado [[02-Decisiones-clave#D13]]. Como solo guardamos número de historia y ángulos, la base es defensible. |
| R3 | MediaPipe deja de funcionar en algún Safari iOS reciente | Baja | Alto | Probar en iPhone 12, 14 y 15. Plan de contingencia: subir a hand-pose-detection (TensorFlow.js) si MediaPipe falla. |
| R4 | Pacientes no escanean QR / no añaden a inicio | Media | Alto — hunde adherencia | Imprimir hoja A4 con instrucciones paso a paso ([[04-Tareas-Frontend#F-14]]). Javi acompaña al primer paciente en consulta. |
| R5 | Javi se va de guardia y no capta los pacientes esperados | Media | Medio | Tener a su compañero de consulta con acceso al panel — sin embargo, en Fase 1 hay un solo doctor. Si pasa, retrasamos hito de 20 pacientes 1-2 semanas. |
| R6 | El despliegue del 15-05 trae bugs que rompen sesiones reales | Alta | Alto | Deploy a Vercel preview el 14-05 y QA exhaustivo. Tener un "kill switch" para volver a master en 1 click. |
| R7 | Sin animaciones de mano para el día del piloto | Alta | Bajo | Lanzar con vídeo grabado provisional o sin animación (solo texto). No bloqueante. |
| R8 | El ancho de banda de la cámara satura el móvil del paciente | Baja | Medio | MediaPipe es local, no sube vídeo. Solo se POSTea JSON ligero. Validado. |
| R9 | El paciente comparte la URL → otra persona usa la cuenta | Baja | Medio | Asumido. Para piloto vale. Post-piloto: añadir token de un solo uso con renovación, o login débil con DOB. |
| R10 | Borrado del legado rompe ramas en curso | Baja | Bajo | El branch actual `master` no tiene PRs abiertos relevantes. Aviso a Javi antes de borrar. |

## Bloqueos externos abiertos
- **Pendiente Gorka**: redactar email a director médico (B-17).
- **Pendiente Javi**: confirmar valores empíricos de calibración con goniómetro (IA-01).
- **Pendiente diseño**: encargar 2 animaciones Lottie de mano (IA-07).
