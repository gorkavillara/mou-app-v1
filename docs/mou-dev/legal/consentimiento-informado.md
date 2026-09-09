---
tipo: documento-legal
relacionada: "[[03-Tareas-Backend#B-17]] · [[02-Decisiones-clave#D13]] · [[02-Decisiones-clave#D3]]"
firma: paciente (y facultativo que informa)
destinatario: paciente incluido en el piloto
estado: BORRADOR — pendiente de revisión por el DPD del hospital
---

> **Qué es esto**: la hoja de información al paciente y el consentimiento que
> [[carta-direccion-hospital|la carta a la Dirección Médica]] promete
> ("a todos los pacientes se les entregará y solicitará un consentimiento
> informado previo"). Sin este documento firmado no se puede incluir al primer
> paciente.
>
> ⚠️ **Es un borrador técnico, no un dictamen jurídico.** Lo he redactado
> ajustándolo a lo que el sistema hace *de verdad* (ver [[06-Modelo-datos]] y el
> anexo [[anexo-tratamiento-datos]]), pero **debe revisarlo el Delegado de
> Protección de Datos del hospital** antes de usarse. Los campos entre
> corchetes y los marcados **[DECIDIR]** están sin resolver a propósito: ver la
> lista al final.

---

# Hoja de información al paciente y consentimiento informado

**Estudio piloto de rehabilitación asistida de la mano (plataforma Mou)**

**Centro**: [Nombre del hospital] · **Servicio**: [Cirugía de la Mano]
**Investigador responsable**: Dr./Dra. [Nombre y apellidos], nº de colegiado [____]

## 1. Por qué le ofrecemos participar

Usted está en fase de rehabilitación tras una intervención o lesión de la mano.
Le proponemos utilizar, **además** de su tratamiento habitual, una herramienta
llamada **Mou** que le permite hacer sus ejercicios en casa mientras la cámara
del móvil mide cuánto mueve los dedos.

Su participación es **totalmente voluntaria**. Si decide no participar, o
retirarse más adelante, **su tratamiento no cambiará en absoluto** y su relación
con el equipo médico tampoco.

## 2. Qué se le pide

- Hacer sus ejercicios de rehabilitación, los mismos que le ha indicado su
  cirujano, delante de la cámara del móvil.
- Abrir un enlace personal (o escanear un código QR) que le entregaremos. No
  hay que instalar nada ni crear ninguna cuenta.
- La pauta prevista es de [3] series de [20] repeticiones, [4] veces al día,
  durante [___] semanas.

La herramienta **no sustituye ni modifica** el tratamiento que le ha indicado su
médico: sólo lo acompaña y toma medidas.

## 3. Qué hace la cámara exactamente (esto es importante)

- La cámara se usa **en tiempo real y en su propio móvil** para calcular los
  ángulos de sus dedos.
- **El vídeo no se graba, no se envía a ningún sitio y no se guarda.** Las
  imágenes se procesan en el momento dentro del navegador de su teléfono y se
  descartan. Lo único que sale de su móvil son **números**: los grados de
  movimiento y el recuento de repeticiones.
- No se le pide ni se registra su cara: la instrucción es encuadrar la mano.

## 4. Qué datos se guardan

Se guardan:

- Un **código de paciente** que le asigna su médico (por ejemplo un número
  correlativo o su nº de historia). **No se guarda su nombre, ni apellidos, ni
  DNI, ni teléfono, ni correo, ni fecha de nacimiento.**
- El **tipo de lesión** (flexor / extensor / otros), la **fecha de la
  intervención** y una **nota clínica breve** escrita por su médico.
- De cada sesión: **fecha y hora, repeticiones realizadas y los grados de
  movimiento** medidos en cada articulación de los dedos.
- Datos **técnicos del dispositivo** con el que hace la sesión: el modelo de
  navegador y el tamaño de la pantalla. Se usan para diagnosticar problemas
  técnicos.

**La lista que relaciona su código con su nombre la guarda únicamente su médico,
fuera de la plataforma.** Por eso, quien acceda al sistema no puede saber quién
es usted; su médico sí, porque tiene esa lista.

> Con todo, y para ser precisos: aunque en el sistema no aparezca su nombre,
> **la ley sigue considerando estos datos como datos personales** (están
> "seudonimizados", no anonimizados), y por eso usted conserva todos los
> derechos que se describen en el punto 7.

## 5. Dónde se guardan y cuánto tiempo

- Los datos se alojan en un servicio de base de datos en la nube
  (**Supabase**), en la región **[DECIDIR: confirmar región del proyecto —
  UE o EE. UU.]**.
- Se conservarán durante **[DECIDIR: plazo]** y después se **[DECIDIR:
  eliminarán / anonimizarán de forma irreversible]**.
- El acceso está restringido a su cirujano y al equipo técnico responsable del
  mantenimiento de la plataforma.

## 6. Riesgos y beneficios

- **Riesgos**: no se prevé ninguno. La herramienta no interviene sobre usted:
  se limita a observar el movimiento con la cámara. No emite radiación, no
  requiere contacto y no modifica su pauta de rehabilitación.
- **Beneficios**: su cirujano podrá seguir su evolución de forma objetiva y
  entre visitas, y detectar antes si algo no avanza como debería. No se le
  garantiza un beneficio directo por participar.

## 7. Sus derechos

Puede **retirar este consentimiento en cualquier momento y sin dar
explicaciones**, y sin que ello afecte a su tratamiento. Puede además solicitar
**acceder** a sus datos, **rectificarlos**, **suprimirlos**, **limitar** u
**oponerse** a su tratamiento, y a la **portabilidad**.

- Para ejercerlos, diríjase a: [nombre y contacto del responsable].
- Delegado de Protección de Datos del centro: [contacto del DPD].
- Si considera que sus derechos no han sido atendidos, puede reclamar ante la
  **Agencia Española de Protección de Datos** (www.aepd.es).

## 8. Declaración del paciente

Declaro que:

- He leído esta hoja de información y he podido preguntar todas mis dudas.
- Se me han explicado el objetivo, el procedimiento y el tratamiento de mis
  datos, y los he entendido.
- Sé que mi participación es voluntaria y que puedo retirarme cuando quiera sin
  que ello afecte a mi asistencia.

☐ **Consiento** participar en el estudio piloto y que se traten mis datos en los
términos descritos.

Código de paciente asignado: **[__________]**

Paciente — Nombre y apellidos: ______________________  Firma: __________  Fecha: ____/____/______

Facultativo que informa — Nombre: ______________________  Nº colegiado: ______  Firma: __________  Fecha: ____/____/______

*(Se entrega una copia al paciente y otra queda en su historia clínica.)*

---

## Decisiones pendientes antes de poder usar esta hoja

Ninguna de estas la puedo resolver yo; son decisiones de Gorka/Javi o del
hospital:

1. **Quién es el responsable del tratamiento**: ¿el hospital, el Dr. Javi como
   facultativo, o Mou? De esto depende medio documento y probablemente haga
   falta un **contrato de encargado de tratamiento** entre el hospital y Mou.
2. **Región de alojamiento** del proyecto Supabase. Si no está en la UE hay que
   documentar la transferencia internacional (o mover el proyecto).
3. **Plazo de conservación** y qué se hace al terminar.
4. **Contactos reales**: responsable, DPD del centro.
5. Si el comité de ética del centro debe evaluarlo (habitual incluso en pilotos
   sin intervención).
