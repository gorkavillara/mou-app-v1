# 02 — Decisiones clave (reunión 2026-04-28)

> Cada decisión enlazada con cita textual de la reunión. Si una decisión cambia, **actualizar este documento** y dejar la entrada anterior tachada con la fecha.

## D1 — Solo panel doctor, sin admin
**Decisión**: Eliminar el panel de Administrador. El doctor da de alta pacientes directamente.
**Por qué**: *"Vamos a hacerlo fácil. Vamos a crear solo un panel de doctor que vas a tener tú tu acceso"*. En la Fase 1 solo hay **un doctor** (Javi). No hace falta multi-rol.

## D2 — Acceso protegido con usuario y contraseña
**Decisión**: El panel del doctor lleva login con user/password.
**Por qué**: *"Esto sí que tiene que estar protegido por contraseña"*.
**Implementación**: 1 usuario hardcodeado en BD inicialmente; auth simple (Supabase Auth o NextAuth con credenciales). No hace falta SSO, MFA ni recuperación por email todavía.

## D3 — Pacientes anónimos por número
**Decisión**: Los pacientes se identifican por **nº de historia clínica** o **ID correlativo** (Paciente 1, Paciente 2…). Nada de nombres.
**Por qué**: *"Solo vamos a poner números paciente. Yo cojo en el Excel: número de historia, nombre, patología, y se le adjudica el número uno"*. La PII se queda en el Excel del médico.
**Implementación**: Campo `external_id` (string libre) único por doctor. Sin email, sin teléfono, sin DOB.

**Nota 2026-05-20 (UX-5)**: a petición del cirujano (test Javi 2026-05-20: *"quizá molaría poder poner el día de la intervención quirúrgica … y algún hueco para poner tenorrafia FDP 5º dedo"*) se añaden `surgery_date` (date) y `surgery_note` (text, máx. 120 chars) a `patients`. Justificación de anonimato: ninguno de los dos campos identifica a una persona; `surgery_note` es jerga clínica acotada (120 chars) y la UI instruye explícitamente a no escribir nombres. La API por token del paciente (`/api/patient/[token]`) **nunca** expone estos campos (minimización de datos): sólo los lee el panel del doctor.

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
**Nota**: En el modelo real (post-piloto) el alta la dará el médico de la mutua, no el cirujano. En Fase 1 lo da Javi porque es prueba de concepto.

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

## D14 — Goniómetro: MCP por dedo, sin promediar (feedback FB-3, 2026-06-15)
**Decisión**: Reescribir cómo se mide y se guarda el goniómetro cuando hay varios dedos afectados. Cinco cambios acoplados (ver [[tests/feedback-gorka-2026-06-15]]):
1. **MCP por dedo afectado, por separado**. El ángulo clínicamente relevante es el **metacarpofalángico (MCP)** del dedo lesionado. La cámara muestra el MCP de **cada** dedo afectado por separado, **no promediado**. (Hoy las etiquetas por-dedo del canvas existen pero están alimentadas con `0` —placeholder muerto—; hay que revivirlas con el MCP normalizado real.)
2. **Persistencia por dedo** ("guardar por dedo, correcto"). `rep_measurements` gana la dimensión **dedo** (nueva columna `finger`). La granularidad pasa de (rep × articulación) a (rep × articulación × dedo). `patient_progression` agrupa también por dedo (filtro de dedo opcional, retrocompatible con filas `finger NULL`). El panel del doctor muestra la progresión **por dedo** (una serie de ROM por dedo afectado).
3. **Selección obligatoria de ≥1 dedo lesionado**. En el panel del doctor pasa a ser **obligatorio** marcar al menos un dedo lesionado, al crear y al editar paciente (`injured_fingers.length >= 1`). Reforzado en backend (Zod `createPatientSchema` / `patchPatientSchema`) y en UI (NewPatientDialog + FingerStatusControl).
4. **Picker simplificado a N/L**. El selector de estado de dedos pasa de N/L/A (Normal/Lesionado/Amputado) a solo **N/L** (Normal/Lesionado). Se retira la opción **Amputado** del UI. Los antiguos "amputados" se tratan como **lesionados**: se **miden** igual, ya no se excluyen. La columna `amputated_fingers` **permanece en la BD pero queda sin uso** (siempre vacía desde el UI); no se elimina para no tocar esquema ni validaciones existentes.

**Por qué**: clínicamente es incorrecto **promediar** el MCP de dos dedos afectados con ROM distinto en un único número (es lo que hace hoy, tanto en cámara como en `rep_measurements`). Además, la selección de dedos afectados era opcional: sin marcar ninguno se promediaba el MCP de los 4 dedos largos, mezclando sanos y afectados. Feedback del dueño (Gorka, 2026-06-15), **bloqueante para el piloto**.

**Nota — revierte parcialmente FB-1**: la D14 retira el estado **Amputado** que FB-1 (2026-06-06) había introducido (picker N/L/A, `amputated_fingers[]` excluidos de la medición, pintados en gris discontinuo). A partir de FB-3 todo dedo afectado es "lesionado" y se mide; `amputated_fingers` queda deprecada/sin uso. Se deja rastro explícito de este cambio de criterio.

## D15 — [Fase 2] ROM completo por articulación de los dedos afectados (sólo afectados)
> **Esta es una decisión de Fase 2, no de piloto.** No bloquea el piloto de 20 pacientes. Base técnica: [[02-Decisiones-clave#D14]] (FB-3) y [[02-Decisiones-clave#D11]].

**Decisión (propuesta del dueño, 2026-06-15)**: en Fase 2, medir y registrar el **ROM completo por articulación** —**MCP + PIP + DIP** de cada dedo, y valorar también la **muñeca**— pero **monitorizando únicamente el/los dedo(s) afectado(s)**. Es decir: rehabilitación articular completa de cada dedo lesionado (no sólo el MCP), restringida a los dedos marcados como lesionados.

**Por qué**: en Fase 1 (FB-3/D14) sólo se mide y muestra el **MCP** por dedo afectado, porque es el ángulo clínicamente prioritario y suficiente para arrancar el piloto. Pero para flexor profundo la **DIP** importa, y para una rehabilitación articular completa hace falta el ROM de las tres articulaciones del dedo lesionado. El lib ya calcula MCP/PIP/DIP (`calculateAllJointAngles`) y los normaliza (`normalizeJointAngle`); los ejercicios sembrados ya tienen `tracked_joints = {MCP, PIP, DIP}`. **D14/FB-3 deja además la BD y el pipeline listos** (granularidad rep × articulación × dedo en `rep_measurements.finger`), por lo que esta Fase 2 es sobre todo **superficie clínica/UI** (mostrar el ROM completo por articulación×dedo afectado) + **validación clínica** de la calibración de PIP/DIP (y de muñeca, hoy un placeholder sin referencia de antebrazo), no cambios de modelo de datos.

**Alcance acoplado** (ver tareas [P2] Fase 2 en los backlogs):
1. **IA**: extender la medición de FB-3 de "sólo MCP" a **MCP+PIP+DIP** por cada dedo afectado, en cámara y en el payload; HUD que muestre las 3 articulaciones por dedo afectado de forma legible.
2. **Frontend doctor**: visualizar la progresión de ROM **por articulación×dedo afectado** (no sólo MCP) en el panel; informe/PDF con ROM completo por dedo afectado.
3. **OPS/clínica**: validación con **goniómetro** de la calibración de **PIP y DIP** (y decidir si se mide la **muñeca** y cómo, dado que hoy su calibración es un placeholder sin referencia de antebrazo). Depende de la sesión clínica con Javi (cirujano), a quien sólo se le pide **validación clínica**, nunca tareas técnicas.
