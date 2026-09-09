---
tipo: documento-legal
relacionada: "[[carta-direccion-hospital]] · [[consentimiento-informado]] · [[06-Modelo-datos]]"
destinatario: Dirección Médica / Delegado de Protección de Datos del hospital
estado: BORRADOR — pendiente de revisión por el DPD del hospital
---

> **Qué es esto**: el anexo técnico que acompaña a
> [[carta-direccion-hospital|la carta a la Dirección Médica]]. La carta explica
> el *qué*; esto responde a lo que preguntará el Delegado de Protección de
> Datos: qué campos exactamente, dónde, cuánto tiempo, quién accede.
>
> Está redactado **contra el esquema real de la base de datos**
> (`supabase/migrations/`, ver [[06-Modelo-datos]]), no contra intenciones.
> Si el modelo de datos cambia, este anexo hay que actualizarlo.

# Anexo técnico — tratamiento de datos en el piloto Mou

## 1. Datos que se registran, campo a campo

| Dato | Campo | Origen | Comentario |
|---|---|---|---|
| Código de paciente | `patients.external_id` | Lo teclea el facultativo | Texto libre: nº de historia o correlativo. **La UI instruye a no escribir nombres.** |
| Tipo de patología | `patients.pathology_code` | Facultativo | `flexor` / `extensor` / `otros` |
| Dedos afectados | `patients.injured_fingers` | Facultativo | Lista de dedos |
| Fecha de intervención | `patients.surgery_date` | Facultativo | Opcional |
| Nota clínica | `patients.surgery_note` | Facultativo | Máx. 120 caracteres, jerga clínica (p. ej. "Tenorrafia FDP 5º dedo") |
| Alta / fin de tratamiento | `patients.started_at`, `discharged_at` | Sistema | Fechas |
| Token de acceso | `patients.access_token` | Sistema | Secreto aleatorio; es la "llave" del enlace del paciente |
| Pauta prescrita | `prescriptions.*` | Facultativo | Series, repeticiones, sesiones/día, duración |
| Sesión realizada | `sessions.*` | Paciente | Inicio, fin, repeticiones hechas vs objetivo |
| Datos técnicos del dispositivo | `sessions.client_metadata` | Navegador | **User-agent, tamaño de viewport y densidad de pantalla** |
| Medición angular | `rep_measurements.*` | Cámara | Por repetición, dedo y articulación: flexión y extensión máximas + indicador de calidad |
| Trazabilidad | `audit_log` | Sistema | Alta de paciente, alta de prescripción y alta médica |

**No existen** en el esquema campos de nombre, apellidos, documento de
identidad, correo, teléfono ni fecha de nacimiento, y su ausencia está fijada
como decisión de producto ([[02-Decisiones-clave#D3]]).

## 2. Lo que NO se guarda: el vídeo

Es el punto que más se pregunta y conviene dejarlo por escrito:

- El vídeo de la cámara **no se graba, no se transmite y no se almacena**.
- El análisis de la mano ocurre **en el propio dispositivo del paciente**,
  dentro del navegador, fotograma a fotograma, y cada fotograma se descarta.
- Lo único que viaja al servidor son **valores numéricos** (grados y recuentos)
  al terminar la sesión.
- La aplicación se lo dice al paciente de forma explícita antes de empezar
  (tareas PRIV-1 y PRIV-2 del proyecto).

## 3. Naturaleza jurídica de los datos — matiz importante

La [[carta-direccion-hospital|carta]] afirma que "no se tratarán datos reales ni
personales". **Conviene precisar esa frase antes de enviarla**, porque tal cual
puede inducir a error al DPD:

- Los datos están **seudonimizados**, no anonimizados: existe una tabla de
  correspondencia (el Excel del facultativo) que permite reidentificar al
  paciente.
- Bajo el RGPD (considerando 26), los datos seudonimizados **siguen siendo
  datos personales**, y además aquí son **datos de salud** (art. 9), categoría
  especial.
- La seudonimización es una **medida de seguridad excelente** y hay que
  destacarla — pero como *medida*, no como argumento para quedar fuera del
  RGPD.

Redacción alternativa sugerida para la carta: *"En la plataforma no se
almacenará ningún dato identificativo directo del paciente. Cada paciente se
identificará únicamente mediante un código, y la correspondencia entre código y
persona permanecerá exclusivamente bajo el control del facultativo, fuera del
sistema (seudonimización). Los datos así tratados siguen siendo datos de salud a
efectos del RGPD y se someterán al régimen que la Dirección y el Delegado de
Protección de Datos establezcan."*

## 4. Alojamiento, acceso y seguridad

- **Proveedor**: Supabase (PostgreSQL gestionado). Región: **[DECIDIR —
  confirmar; si no es UE, documentar la transferencia internacional]**.
- **Aplicación**: desplegada en Vercel.
- **Aislamiento por facultativo**: la base de datos aplica *Row Level Security*,
  de modo que cada cirujano sólo puede leer y escribir los pacientes que ha dado
  de alta él.
- **Acceso del paciente**: sin cuenta ni contraseña, mediante un enlace con
  token aleatorio. Al dar el alta médica el enlace **deja de funcionar**
  (responde 410).
- **Acceso del equipo técnico**: limitado al mantenimiento; **[DECIDIR:
  formalizar quién, con qué credenciales y con qué registro de accesos]**.
- **Trazabilidad**: `audit_log` registra las altas de paciente, de prescripción
  y el alta médica.

## 5. Base legal y figuras — a resolver con el DPD

Estos puntos **no están decididos** y son los que bloquean el envío:

1. **Responsable del tratamiento**: ¿el hospital? ¿el facultativo? Lo habitual
   es que sea el centro.
2. **Encargado del tratamiento**: si Mou opera la infraestructura, hará falta un
   **contrato de encargo** (art. 28 RGPD) entre el centro y Mou, y listar a
   Supabase y Vercel como **subencargados**.
3. **Base legal**: consentimiento explícito del paciente (art. 9.2.a) frente a
   fines de investigación en salud. Determina qué hay que firmar y qué se puede
   hacer con los datos después.
4. **Plazo de conservación** y destino final de los datos.
5. Si procede **evaluación de impacto (EIPD)** y/o dictamen del **comité de
   ética** del centro.

## 6. Estado del documento

Borrador técnico redactado por el equipo de desarrollo, fiel al sistema tal
como está construido a fecha de **2026-09-09**. **No es asesoramiento jurídico**
y debe revisarlo el Delegado de Protección de Datos del centro antes de
adjuntarlo a ninguna solicitud.
