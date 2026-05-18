# Plan de pruebas piloto — Mou

> **App**: https://mou-v1.vercel.app/
> **Fecha**: 2026-05-11
> **Reparto**: Javi (cirujano, Valencia) · Gorka (dev, San Sebastián)
> Cómo reportar fallos: ver [[#📋 Cómo reportar lo que falle]] al final.

---

## Resumen en una frase

Javi prueba que la herramienta tiene sentido **como médico** (dar de alta un paciente, mandarle ejercicios, ver si los hace). Gorka se encarga de lo técnico y de meter en el sistema los valores de ángulos que Javi mida con el goniómetro.

---

## ℹ️ Acceso a la calibración (resuelto)

La pantalla de calibración de ángulos (`/dev/calibration`) ya es accesible en la web publicada detrás de una clave. En Vercel está la env var `CALIBRATION_KEY`; Javi entra con la URL `https://mou-v1.vercel.app/dev/calibration?key=<valor>` que le pasa Gorka. En local (sin esa var) la página sigue abierta sin clave. El bloqueante de la Fase 3 (tarea G-5) está cerrado.

---

# 👨‍💻 FASE 0 — Gorka (San Sebastián) · antes de avisar a Javi

Checklist técnico. Cuando esté todo ✅, avisa a Javi de que puede empezar la Fase 1.

- [x] **G-1** Confirmar que el deploy responde: abrir https://mou-v1.vercel.app/login → debe verse el formulario "Mou · Panel del doctor".
- [x] **G-2** Confirmar las env vars en Vercel (Project Settings → Environment Variables): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Apuntan al proyecto `qkvujadxflslsfkezxpo` (el mismo que en local, así que el doctor Javi ya existe en esa BD).
- [x] **G-3** Verificar el login de Javi contra producción:
  ```bash
  curl -s -X POST "https://qkvujadxflslsfkezxpo.supabase.co/auth/v1/token?grant_type=password" \
    -H "apikey: <SUPABASE_ANON_KEY>" -H "Content-Type: application/json" \
    -d '{"email":"javi@mou.local","password":"javimou"}' | head -c 80
  ```
  Debe devolver un `access_token`. Si no → re-ejecutar `npx tsx scripts/create-doctor.ts --email javi@mou.local --password javimou --label "Dr. Javi"`.
- [x] **G-4** Borrar pacientes de prueba acumulados para que Javi empiece con la lista limpia: `npx tsx scripts/cleanup-e2e-data.ts` (solo limpia los del doctor e2e; los de Javi se borran a mano si hubiera). Decidir si la lista de Javi arranca vacía.
- [x] **G-5** Hecho. En Vercel está la env var `CALIBRATION_KEY`; Gorka le pasa a Javi la URL `https://mou-v1.vercel.app/dev/calibration?key=<valor>`. En local (sin la var) la página sigue abierta.
- [ ] **G-6** Tener a mano el móvil de Javi o un Android/iPhone para la Fase 2 (la cámara). Confirmar que Vercel sirve por HTTPS (lo hace) — `getUserMedia` necesita HTTPS, y Vercel ya lo da.
- [ ] **G-7** Avisar a Javi: "ya puedes entrar, empieza por la Fase 1 del plan".

---

# 🧑‍⚕️ FASE 1 — Javi (Valencia) · el panel del doctor

> No necesitas saber nada técnico. Solo un navegador (Chrome) en el ordenador. Vas a hacer de ti mismo: el cirujano que da de alta a un paciente.

### Acceso

1. Abre **https://mou-v1.vercel.app/** en Chrome.
2. Te pedirá entrar. Datos:
   - **Correo**: `javi@mou.local`
   - **Contraseña**: `javimou`
3. Pulsa **Iniciar sesión**. Deberías ver la pantalla "Pacientes".

### Prueba 1 — Dar de alta un paciente de prueba

1. Arriba a la derecha, botón azul **"Nuevo paciente"**.
2. Comprueba: **¿el cuadro que se abre sale centrado en la pantalla?** (Antes salía arriba a la izquierda — esto era un fallo que debería estar corregido).
3. Pon un identificador de prueba: por ejemplo `PRUEBA-1` (NO pongas nombres reales de pacientes — el sistema es anónimo a propósito).
4. En "Patología" elige **Flexor** (o lo que quieras probar).
5. Pulsa **Crear paciente**.
6. Debes aterrizar en la ficha de ese paciente.

### Prueba 2 — Mirar el código QR del paciente

1. En la ficha, busca el recuadro **"Acceso del paciente"**: hay un **código QR** y una **dirección web**.
2. Pulsa el botón **Imprimir** (o `Ctrl+P`).
3. Comprueba: **la hoja que sale para imprimir, ¿muestra SOLO el QR + el identificador + la fecha?** No debería salir el resto de la pantalla (ni el menú, ni la lista). Esto es lo que entregarías al paciente en consulta.

### Prueba 3 — Mandarle ejercicios al paciente

1. En la ficha, sección "Prescripciones", pulsa **"Añadir ejercicio"** (o "Añadir").
2. Comprueba que arranca en **"Sin fecha de fin"** (esto significa: el tratamiento NO caduca solo; solo termina cuando tú pulses "Finalizar rehabilitación" — como pediste).
3. Elige el ejercicio (hay dos: *flexión pasiva de dedos* y *extensión activa de dedos*).
4. Pon, por ejemplo: **3 series, 20 repeticiones, 4 sesiones al día**.
5. Mira la frase azul de previsualización: debería decir algo como *"3 series × 20 reps × 4 sesiones/día (sin fecha de fin)"*. **¿Tiene sentido clínico cómo está redactado?** Apunta si cambiarías el texto.
6. Pulsa **Añadir**. El ejercicio debe aparecer en la lista de la ficha.
7. *(Opcional)* Repite y prueba la otra opción, **"Hasta una fecha"**, poniendo p.ej. 14 días, para ver que también funciona.

### Prueba 4 — La lista de pacientes

1. Vuelve a "Pacientes" (logo Mou arriba a la izquierda o atrás).
2. Comprueba que el paciente que creaste aparece con:
   - Su identificador.
   - Una barra de **adherencia** (estará a 0% o vacía hasta que el paciente haga ejercicios).
   - "Última sesión: sin sesiones todavía".
3. Usa el **buscador** de arriba: escribe parte del identificador y dale a Enter. Debe filtrar.
4. **¿Echas en falta alguna columna o dato que como médico necesitarías ver de un vistazo?** Apúntalo.

### Prueba 5 — Finalizar el tratamiento

1. Entra en la ficha del paciente de prueba.
2. Botón **"Finalizar rehabilitación"** (arriba a la derecha de la ficha).
3. Confirma. El estado debe pasar a **"Dado de alta"** y el botón desaparece.
4. *(Esto simula el alta clínica que darías cuando el paciente se ha recuperado.)*

### ✅ Qué quiero que me digas de la Fase 1

- ¿El flujo "doy de alta → mando ejercicios → entrego QR" te resulta natural como cirujano?
- ¿Falta algún campo clínico imprescindible? (¿tipo de cirugía, fecha de operación, mano operada…?)
- Cualquier texto que como médico cambiarías.
- Cualquier cosa que se vea rara, descuadrada o que no entiendas.

---

# 📱 FASE 2 — Javi (Valencia) · ponte tú de "paciente"

> Ahora haces de paciente: vas a usar el móvil como lo haría alguien al que acabas de operar.

1. Desde el ordenador, en la ficha de un paciente **activo** (no dado de alta), con al menos un ejercicio asignado: mira el **QR** de "Acceso del paciente".
2. Con la **cámara del móvil**, escanea ese QR. Se abre una web.
3. *(Como haría el paciente)* en el móvil: menú del navegador → **"Añadir a pantalla de inicio"**. Comprueba que queda un icono "Mou".
4. En esa web verás los ejercicios del día y un botón **"Empezar"**. Pulsa.
5. El móvil pedirá **permiso de cámara**. Acepta.
6. Pon la mano delante de la cámara y haz el gesto del ejercicio (abrir/cerrar la mano).
7. Observa:
   - ¿Cuenta repeticiones?
   - Arriba a la derecha hay un **número de grados en vivo** y unas barritas. **¿El número sube y baja de forma coherente cuando flexionas y extiendes?** (No te fijes aún en si el valor exacto es correcto — eso es la Fase 3 con goniómetro. Solo: ¿se mueve en el sentido que esperas?)
   - Si haces 3 repeticiones "flojas" (sin llegar a cerrar), ¿sale un aviso animándote a llegar más lejos?
8. Termina la sesión (botón "Terminar" o al completar las repeticiones). Debe salir un resumen y "datos guardados".
9. Vuelve al **ordenador**, a la ficha de ese paciente: ¿aparece la sesión en "Sesiones recientes" y se mueve la barra de adherencia / la gráfica?

### ✅ Qué quiero que me digas de la Fase 2

- ¿El paciente medio (gente mayor, poca maña) sería capaz de hacer esto solo en casa? ¿Dónde se atascaría?
- ¿La cámara detecta bien la mano o se pierde mucho?
- ¿El conteo de repeticiones es fiable?
- Idioma/instrucciones para el paciente: ¿se entienden?

---

# 📐 FASE 3 — Validación de ángulos · Javi + Gorka juntos

> **Esta es la parte clínicamente crítica.** Sin esto, los grados que mide la cámara no son fiables y el dato no vale para vender a la mutua. Necesita tu goniómetro, Javi.

**Pre-requisito**: Gorka ha completado **G-5** (habilitar la pantalla de calibración) y te ha pasado una URL tipo `https://mou-v1.vercel.app/dev/calibration?key=...`.

### Lo que hace Javi (tú, con el goniómetro)

1. Abre la URL de calibración que te pase Gorka, en el ordenador con cámara (o móvil).
2. Verás la mano detectada y, en un panel, números de cada articulación (MCP, PIP, DIP, muñeca) en "crudo" y "normalizado".
3. **Posición A — mano totalmente abierta/plana**: ponla recta como si la apoyaras en una mesa. Mide con el goniómetro que efectivamente está a ~0°. Pulsa el botón **"Capturar referencia"** (posición abierta).
4. **Posición B — puño cerrado completo**: cierra la mano del todo. Mide con goniómetro el ángulo real de cada articulación. Pulsa **"Capturar referencia"** (posición cerrada).
5. La pantalla te genera un **bloque de texto (JSON)**. Cópialo entero.
6. **Apunta también, a mano, lo que marca tu goniómetro** en esas dos posiciones para MCP, PIP, DIP y muñeca. Esto es oro: es el "valor real" contra el que comparamos.
7. Pásale a Gorka: (a) el bloque JSON copiado, (b) tus medidas reales del goniómetro.

> Repite la captura 2-3 veces en condiciones distintas (más/menos luz, cámara más cerca/lejos) si puedes — cuantas más referencias, mejor calibramos.

### Lo que hace Gorka (técnico)

- [ ] **G-8** Recibir de Javi el JSON + las medidas de goniómetro.
- [ ] **G-9** Meter esos valores en `JOINT_CALIBRATION` (`src/lib/hand-tracking.ts`), commit, push → Vercel redeploya solo.
- [ ] **G-10** Avisar a Javi de que ya está actualizado para que vuelva a comprobar.

### Validación final (Javi otra vez)

1. Con la calibración ya aplicada, repite: mano abierta debe marcar **~0°**, puño cerrado debe marcar **~90°** (MCP), **~100°** (PIP), **~80°** (DIP).
2. Coge el goniómetro y compara en 8-10 posiciones intermedias. Apunta dónde se desvía más.
3. **Criterio de aprobado**: error medio ≤ 10°, máximo ≤ 15°. Si no se cumple, anótalo y volvemos a calibrar.

---

# 👨‍💻 FASE 4 — Gorka · cierre técnico

- [ ] **G-11** Una vez Javi valida los ángulos: marcar **OPS-1** como hecho en [[13-Tablero]].
- [ ] **G-12** Volver a poner el gate de `/dev/calibration` (que no quede abierto en producción sin clave indefinidamente), o dejar la clave si se va a seguir recalibrando durante el piloto. Decidir.
- [ ] **G-13** Smoke final en producción: login Javi, crear paciente, asignar ejercicio, abrir URL paciente en móvil real, completar una sesión, ver el dato en la ficha. (Es la Fase 1+2 de Javi pero hecha por ti como verificación de humo de despliegue.)
- [ ] **G-14** Pendiente no técnico que sigue abierto: **B-17** — documento legal para el director médico (lo redacta Gorka, no es código pero bloquea captar pacientes reales).

---

## 📋 Cómo reportar lo que falle

Javi: no hace falta que sepas nada técnico. Crea un archivo nuevo en esta carpeta (`docs/obsidian-vault/tests/`) con el nombre `feedback-javi-<fecha>.md`, o si no usas Obsidian simplemente **mándale a Gorka una lista numerada** por el canal que uséis, indicando:

1. **En qué pantalla** estabas (ej. "creando un paciente").
2. **Qué hiciste** (ej. "pulsé Crear paciente").
3. **Qué esperabas** vs **qué pasó**.
4. Si puedes, una **captura de pantalla** (en el móvil/PC).

Plantilla rápida:

```
1. Pantalla: ...
   Hice: ...
   Esperaba: ...
   Pasó: ...
```

Gorka triará cada punto: lo que sea bug → al tablero como `FIX-x`; lo que sea decisión clínica → lo hablamos.

---

## Reparto en una tabla

| # | Quién | Dónde | Tarea |
|---|---|---|---|
| G-1..G-7 | Gorka | San Sebastián | Pre-vuelo técnico antes de avisar a Javi |
| Fase 1 | Javi | Valencia | Probar el panel del doctor (alta, prescripción, QR, lista, alta clínica) |
| Fase 2 | Javi | Valencia | Hacer de paciente con el móvil + cámara |
| Fase 3 | Javi + Gorka | — | Validar ángulos con goniómetro ↔ integrar calibración |
| G-8..G-14 | Gorka | San Sebastián | Integrar calibración, cierre técnico, doc legal |
