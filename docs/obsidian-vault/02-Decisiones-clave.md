# 02 — Decisiones clave (reunión 2026-04-28)

> Cada decisión enlazada con cita textual de la reunión. Si una decisión cambia, **actualizar este documento** y dejar la entrada anterior tachada con la fecha.

## D1 — Solo panel doctor, sin admin
**Decisión**: Eliminar el panel de Administrador. El doctor da de alta pacientes directamente.
**Por qué**: *"Vamos a hacerlo fácil. Vamos a crear solo un panel de doctor que vas a tener tú tu acceso"*. En la Fase 1 solo hay **un doctor** (Miguel). No hace falta multi-rol.

## D2 — Acceso protegido con usuario y contraseña
**Decisión**: El panel del doctor lleva login con user/password.
**Por qué**: *"Esto sí que tiene que estar protegido por contraseña"*.
**Implementación**: 1 usuario hardcodeado en BD inicialmente; auth simple (Supabase Auth o NextAuth con credenciales). No hace falta SSO, MFA ni recuperación por email todavía.

## D3 — Pacientes anónimos por número
**Decisión**: Los pacientes se identifican por **nº de historia clínica** o **ID correlativo** (Paciente 1, Paciente 2…). Nada de nombres.
**Por qué**: *"Solo vamos a poner números paciente. Yo cojo en el Excel: número de historia, nombre, patología, y se le adjudica el número uno"*. La PII se queda en el Excel del médico.
**Implementación**: Campo `external_id` (string libre) único por doctor. Sin email, sin teléfono, sin DOB.

## D4 — Catálogo inicial de 2 ejercicios
**Decisión**: Empezamos con **flexión pasiva de dedos** y **extensión activa de dedos**.
**Por qué**: *"Solo tenemos dos ejercicios porque son dos ejercicios muy básicos para cualquier patología en particular ahora de momento. Vamos a probar solo con eso, no vamos a hacer 100.000 ejercicios"*.
**Más adelante**: ampliar a 4 cuando los vídeos estén montados (*"con cuatro ejercicios lo tenemos montado y sobra"*).

## D5 — Prescripción parametrizable por paciente
**Decisión**: Por paciente, el doctor configura:
- Lista de ejercicios asignados.
- **Series** (ej. 3) × **repeticiones** (ej. 20) por sesión.
- **Frecuencia** (ej. cada 3 horas) o nº de sesiones/día.
- **Duración** en días hasta próxima consulta.

**Por qué**: *"Que pueda ser tres sesiones al día de 20 repeticiones o puedas elegir cuatro sesiones al día de 25 repeticiones, y también el cuántos días"*. La rutina varía entre flexor y extensor.

## D6 — Cierre de tratamiento manual
**Decisión**: El doctor pulsa un botón **"Finalizar rehabilitación"** desde el panel para cerrar.
**Por qué**: *"Tendrías que poder desde tu panel dentro de ese paciente decirle: vale, pum, finaliza tratamiento"*.
**Nota**: En el modelo real (post-piloto) el alta la dará el médico de la mutua, no el cirujano. En Fase 1 lo da Miguel porque es prueba de concepto.

## D7 — Onboarding paciente vía URL única + QR
**Decisión**: Cada paciente recibe una URL única no adivinable. El doctor genera un **QR imprimible** desde el panel. El paciente escanea, abre, y "añadir a pantalla de inicio".
**Por qué**: *"Una URL única para cada uno de ellos. […] Los pacientes son retrasados, imprimirles el QR y ya. Lo ves: claro, fácil"*.
**Sin login del paciente**: la URL es la credencial. Asumimos que no se comparte.

## D8 — Sin notificaciones push (de momento)
**Decisión**: No implementamos recordatorios push al paciente en la Fase 1.
**Por qué**: *"Estaría guay que les llegara una notificación al móvil. — La URL y que se acuerde. Lo pregunto ahora si quieres. — No no, mejor que se acuerde"*. Si no se acuerdan, es dato útil (mide adherencia real).

## D9 — Vídeos: mano animada en lugar de grabación real
**Decisión**: La guía visual del ejercicio será una **mano dibujada/animada** o un **filtro** aplicado a la grabación, no un vídeo del médico haciéndolo.
**Por qué**: *"Sería mejor una mano de coña más que un vídeo mío haciéndolo. Si puede ser, mejor solo una mano de dibujo. […] Se puede mirar o pasar algún filtro"*.

## D10 — IA: normalización de rango 0–90°
**Decisión**: Calibrar los cálculos de ángulos para que **mano completamente abierta = 0°** y **flexión completa = 90°** (en muñeca y dedos según corresponda).
**Por qué**: Hoy mide valores raros. *"Cuando llega aquí [posición de 90°] sea 90, pues entonces es un triunfato. Y esto sí que tiene que ser cero"*. **Sin esto, el sistema no es vendible**.

## D11 — IA: detectar articulaciones interfalángicas
**Decisión**: Calcular el ángulo de **MCP, PIP y DIP** por separado para cada dedo, no solo el ángulo global del dedo.
**Por qué**: *"Vas a calcular los grados de esta articulación, de esta y de esta — o sea de las interfalángicas — lo que tú me digas. ¿Se pueden calcular los tres a la vez?"*. Para flexor profundo, la DIP importa; para extensor, la MCP. Sin separar, se pierde el dato clínico.

## D12 — Adherencia en panel del doctor
**Decisión**: En la lista de pacientes y en el detalle, mostrar **% de sesiones completadas** sobre las prescritas, hasta el día actual.
**Por qué**: Es el **valor de venta** a la mutua. *"Esos datos se van almacenando sin que tú hagas nada"* y sirven para demostrar adherencia.

## D13 — Documento legal mínimo antes de captar pacientes
**Decisión**: Antes de captar los 20 pacientes, redactar un **email/documento dirigido al director médico** explicando: qué hace el sistema, qué datos captura, base legal, retención, contacto.
**Por qué**: *"Aquí hay datos comprometen a la gente. […] Tienes que presentar como un documento de que tú vas a hacer algo. Por lo menos los mando por email y ya tienen el [registro]"*.
**No bloqueante** para el desarrollo, pero sí para el día del despliegue del piloto.
