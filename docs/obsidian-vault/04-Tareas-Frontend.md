# 04 — Tareas Frontend

> Convenciones: `[P0]` bloqueante para piloto · `[P1]` necesario antes de mutua · `[P2]` deseable.

## P0 — Limpieza

### F-01 [P0] Borrar legado UI
Ver [[08-Legado-a-eliminar]]. Tirar `src/app/admin/`, `src/app/doctor/` antiguo, `src/components/admin/`, `src/components/doctor/` antiguos, `src/lib/doctor-*.ts`. Commit aislado de borrado.

## P0 — Doctor: navegación y shell

### F-02 [P0] Layout `src/app/doctor/layout.tsx` nuevo
- Header con nombre del doctor + botón logout.
- Tema claro y oscuro (commit `cf5866f` ya añadió dark mode al admin; rescatar el patrón).
- Contenido principal en `<main>` con max-width.

### F-03 [P0] Página `/doctor` (lista pacientes)
- Tabla / cards con: `external_id`, fecha alta, días activo, **% adherencia** con barra, estado (`activo` / `dado de alta`).
- **Buscador** en la cabecera filtrando por `external_id` (server-side via query a B-07).
- Botón "+ Nuevo paciente" arriba a la derecha.
- Click en fila → `/doctor/pacientes/[id]`.

### F-04 [P0] Modal/página "Nuevo paciente"
- Form: `external_id` (input texto, validar único en cliente con debounce), `pathology_code` (select opcional).
- Tras crear, redirige a la pantalla de detalle del paciente con el QR ya visible.

### F-05 [P0] Página `/doctor/pacientes/[id]`
Secciones:
1. **Cabecera**: external_id grande, días desde alta, botón "Finalizar rehabilitación".
2. **Acceso del paciente**: QR (vía `<img src="/api/doctor/patients/:id/qr.png">`), URL en texto + botón copiar, botón "Imprimir" (`window.print()` con CSS print).
3. **Prescripciones activas**: lista con sets×reps, frecuencia, días restantes. Botón "+ Añadir ejercicio".
4. **Adherencia**: barra y números (hoy, 7 días, total).
5. **Progresión angular**: gráfico Recharts con líneas por articulación (MCP, PIP, DIP, muñeca). Eje Y 0-90°, eje X días. Filtros por articulación.
6. **Historial de sesiones**: tabla cronológica (fecha, ejercicio, reps, calidad).

### F-06 [P0] Form "Añadir prescripción"
Modal o sheet lateral.
- Select ejercicio (de los 2 del catálogo).
- Inputs numéricos: sets, reps_per_set, sessions_per_day, duration_days.
- Date picker `starts_on` (default: hoy).
- Preview en texto: *"3 series de 20 reps, 8 sesiones/día durante 14 días = 168 reps/día × 14 = 2.352 reps totales prescritas"*.

### F-07 [P0] Botón "Finalizar rehabilitación"
- Confirmación modal: *"Esto cierra el tratamiento del paciente {external_id}. Las URL del paciente dejarán de funcionar. ¿Continuar?"*
- POST a B-10. Recargar.

## P0 — Paciente: vista por URL

### F-08 [P0] Ruta `/p/[token]/page.tsx` (nueva)
Reemplaza el flujo actual `/exercises` directo.
- Server component: llama a B-11. Si token inválido → 404. Si tratamiento cerrado → mensaje de cierre.
- Pasa al client la lista de prescripciones + ejercicios.

### F-09 [P0] Pantalla "qué toca ahora"
- Header simple: "Sesión {n+1} de {sessions_per_day}".
- Lista de ejercicios prescritos con su animación.
- Botón gigante "Empezar sesión".
- Click → reutiliza el flujo de cámara existente (`exercises/page.tsx`).

### F-10 [P0] Adaptar `exercises/page.tsx` para piloto
- Recibe `prescription_id`, `target_reps`, `tracked_joints` desde props/query.
- Al terminar, **POST a B-12** con todos los `rep_measurements` capturados.
- Pantalla de fin: *"¡Hecho! 18/20 repeticiones. Próxima sesión: dentro de 3 horas"*.

### F-11 [P0] PWA mínima para "añadir a pantalla de inicio"
- `manifest.json` con icon, name "Mou", display `standalone`, start_url con el token (o sin él, que entre por la URL guardada).
- Meta tags Apple: `apple-mobile-web-app-capable`, `apple-touch-icon`.
- Sin service worker complejo en Fase 1; solo lo justo para que "añadir a inicio" funcione bonito.

## P1 — Calidad clínica visible

### F-12 [P1] Mano animada del ejercicio
Componente `<ExerciseAnimation exerciseCode={...} />`. Loop SVG/Lottie de mano dibujada haciendo el movimiento. Reemplaza vídeo del médico [[02-Decisiones-clave#D9]].
- Producción de los 2 GIFs/Lotties: tarea de diseño, no código. Trackeada en [[07-Plan-piloto-20-pacientes]].

### F-13 [P1] Indicador en vivo del ángulo durante el ejercicio
Mientras la cámara graba, mostrar overlay: *"Flexión actual: 78°"* — útil para que el paciente vea progreso en tiempo real, y para que el médico confirme que la cámara está midiendo bien.

### F-14 [P1] Pantalla de impresión QR
`@media print` en CSS. Cuando el doctor pulsa "Imprimir", la hoja A4 muestra:
- QR grande centrado.
- Texto "Escanea para empezar tu rehabilitación".
- Logo Mou.
- Pie: ID paciente + fecha alta.

## P2 — Refinamientos

### F-15 [P2] Modo oscuro en panel doctor
Reaprovechar lógica del admin (`cf5866f`).

### F-16 [P2] Indicador "última sesión hace X horas" en lista de pacientes
Ayuda a Miguel a ver de un vistazo quién está flojeando.
