# 01 — Visión Fase 1

## Qué es Mou
Plataforma para que pacientes operados de tendones (sobre todo **flexores y extensores de mano**) hagan los ejercicios de rehabilitación **en casa** entre visitas, con la **cámara del móvil** verificando que se ejecutan, cuántas veces y con qué calidad de movimiento.

## Quién es el cliente real (importante)
El cliente final no es el cirujano ni el paciente: es **la mutua**. La mutua paga días de baja. Cada día que el paciente no rehabilita = días extra de baja = más coste.

> *"En el momento en que tengas un control [sobre la rehabilitación], los 90 días de baja se te cambian a 50, literalmente"*

Por eso la métrica de oro es: **adherencia demostrable** + **rango articular real**. Sin eso, el dato no vale.

## Ámbito de la Fase 1
Mínimo viable para **vender el concepto a una mutua** mostrando datos de **20 pacientes reales**.

### Alcance ✅
1. **Panel único de doctor**, protegido por usuario/contraseña.
2. **Alta de pacientes anónimos** (solo número de historia o ID correlativo, sin PII).
3. **Asignación de tratamiento**: 1–2 ejercicios, series × repeticiones × frecuencia, duración en días.
4. **Onboarding del paciente sin login**: URL única → QR imprimible → "añadir a pantalla de inicio".
5. **Monitorización de adherencia**: % sesiones completadas vs prescritas.
6. **Cierre de tratamiento**: botón de alta.
7. **IA normalizada**: rango 0–90° real para flexión de muñeca/dedos, con articulaciones interfalángicas detectadas.
8. **Vídeos guía**: animación o filtro sobre mano (no vídeos reales del médico).

### Fuera de alcance ❌
- Panel de administrador (lo gestiona el doctor).
- Multi-doctor / multi-mutua.
- Notificaciones push al paciente (postpuesto — solo URL como recordatorio).
- Mensajería bidireccional doctor↔paciente (postpuesto).
- Catálogo amplio de ejercicios (solo 2 al principio: flexión pasiva dedos, extensión activa dedos).
- App nativa.

## Principios de diseño

### Privacidad por defecto
> *"Va a haber datos comprometidos. Tienes que presentar como un documento de que vas a hacer algo"* — Director médico

- **No PII en la base de datos**: ni nombre, ni DNI, ni email del paciente.
- Identificación por **nº de historia clínica** o **ID correlativo** (1, 2, 3…).
- El doctor mantiene la correspondencia ID↔persona en **su Excel local**, no en el sistema.
- URLs únicas no adivinables (UUID o slug aleatorio largo).

### Simplicidad operativa
- El paciente **no tiene login**. Escanea QR una vez, lo guarda en pantalla inicio, y ya.
- El doctor **olvida al paciente** después del alta hasta que vuelva a consulta. El sistema captura datos solo.

### Calidad clínica > pulido UI
La medida en grados tiene que ser **real**. Si la flexión completa marca 90° y la mano abierta marca 0°, ya tenemos historia para vender. Si marca números aleatorios, no.

## Indicador de éxito del piloto
Que en la primera reunión con la mutua podamos mostrar:
- 20 pacientes reales registrados.
- Para cada uno: prescripción + sesiones realizadas vs prescritas + curva de progresión angular.
- Comparación grosso modo: con Mou vs sin Mou (días estimados de baja según baremos de mutua).
