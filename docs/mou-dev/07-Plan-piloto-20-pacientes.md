# 07 — Plan piloto 20 pacientes

## Objetivo
Tener el sistema en producción y captar el primer paciente real **el viernes 2026-05-15**.
Llegar a 20 pacientes en las **4-6 semanas siguientes** (Javi opera ~4-5 pacientes de mano por guardia, varias guardias al mes; sumar lo que aporte un compañero suyo en consulta).

## Cronograma sugerido (8 días laborables)

> Hoy = **viernes 2026-05-08**. Deadline = **viernes 2026-05-15** (7 días naturales).
> Asume 1 dev a tiempo completo. Si no, recortar P1.

### Día 1 — viernes 2026-05-08 (hoy)
- ✅ Reunión + planificación ([[02-Decisiones-clave]]).
- 🚧 Crear vault Obsidian (este documento).
- ⏭️ Rama `feat/fase1-reset`. Borrar legado [[08-Legado-a-eliminar]]. Commit.
- ⏭️ Crear esquema BD nuevo [[06-Modelo-datos]]. Migración Supabase. Seed mínimo. (B-01 a B-04).

### Día 2 — sábado 2026-05-09 (opcional)
- IA-01 + IA-02: documento angular y refactor de `hand-tracking.ts`. Sin UI todavía, solo el motor.

### Día 3 — lunes 2026-05-11
- B-05: Login doctor (1h, ya hay base).
- B-06, B-07, B-09: APIs de pacientes y prescripciones.
- F-02, F-03: layout + lista de pacientes con buscador.

### Día 4 — martes 2026-05-12
- F-04, F-05 (parcial): nuevo paciente + detalle paciente.
- F-06: form de prescripción.
- B-15: endpoint de QR.

### Día 5 — miércoles 2026-05-13
- F-08, F-09, F-10: ruta `/p/[token]` + adaptación de `exercises/page.tsx` para piloto.
- B-11, B-12: APIs paciente.
- F-11: PWA mínima (manifest + meta tags).

### Día 6 — jueves 2026-05-14
- IA-03: normalización 0–90°. **Test cara a cara con Javi y goniómetro.**
- F-13/IA-08: indicador en vivo de ángulo.
- B-10, F-07: discharge.
- F-14: pantalla de impresión QR.

### Día 7 — viernes 2026-05-15 (DEPLOY)
- 09-12h: deploy a producción (Vercel + Supabase prod), QA en móvil real.
- 12-14h: bugs encontrados.
- 16h: **primer paciente real en consulta**. Acompañar a Javi para verificar el flujo end-to-end.

### Semana siguiente
- B-13, B-14: adherencia + progresión angular.
- F-12 + IA-07: animaciones de mano (encargar).
- B-16: auditoría.
- B-17: documento legal para director médico ([[02-Decisiones-clave#D13]]) — **crítico antes del paciente nº 5 si no antes**.

## Hitos de captación

| Hito | Fecha objetivo | Acción |
|---|---|---|
| Sistema desplegado | 2026-05-15 | Despliegue + QR pruebas |
| Paciente 1 | 2026-05-15 | Javi en su próxima cura programada |
| Pacientes 5 | 2026-05-22 | Compañero de Javi se suma |
| Pacientes 10 | 2026-05-29 | Otra guardia de Javi |
| Pacientes 20 | 2026-06-12 | Listos para mostrar a mutua |

## Riesgo si se retrasa
- **Pierdes la guardia del 15-05** → el siguiente bloque de 4-5 pacientes nuevos viene con la siguiente guardia (varios días de retraso).
- **No hay normalización 0-90° funcional** → datos inservibles, hay que repetir captura. Es tirar el piloto.

## Criterios de "listo para piloto"
Antes del 15-05 confirmar uno por uno:
- [ ] Doctor puede loguearse, crear paciente, asignar prescripción y ver QR.
- [ ] Paciente puede escanear QR, abrir, ver ejercicio, completar sesión y los datos llegan a BD.
- [ ] Reps se cuentan correctamente (validado con 5 sesiones de prueba personales).
- [ ] Ángulos son creíbles (mano abierta ≈ 0°, puño ≈ 90° MCP, validado con Javi).
- [ ] El doctor ve adherencia básica en su panel (puede ser P1 si va justo, pero al menos sesiones realizadas vs prescritas en bruto).
- [ ] El sitio funciona en iPhone 12+ y Android medio actualizado, en Safari y Chrome.
- [ ] Tratamiento se puede finalizar y el QR deja de funcionar.

## No-objetivo del piloto
- Animaciones de mano definitivas (P1, posterior).
- Modo oscuro perfecto.
- Reportes en PDF.
- Mensajería.
- Mutua dada de alta como "cliente" en el sistema.
