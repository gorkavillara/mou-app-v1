# Delta for Patient Tracking

## Purpose

Extender el sistema de ejercicios de rehabilitación con validación de identidad por hand tracking, sistema dual-stream para entrada de datos, y notificaciones push basadas en schedule de baja laboral.

## ADDED Requirements

### Requirement: Hand Identity Validation

El sistema DEBE validar la identidad del paciente mediante comparación de hand signature antes de iniciar una sesión de ejercicio.

#### Scenario: Validación exitosa de identidad

- GIVEN el paciente tiene un hand signature registrado en su perfil
- WHEN inicia sesión de ejercicio y el sistema captura los landmarks de la mano
- THEN el sistema compara el hand signature capturado con el registrado
- AND si la similitud es >= 85%, permite continuar con la sesión

#### Scenario: Validación de identidad fallida

- GIVEN el paciente tiene un hand signature registrado en su perfil
- WHEN la similitud del hand signature capturado es < 85%
- THEN el sistema muestra alerta de identidad no verificada
- AND permite continuar con código manual de 4 dígitos como fallback

#### Scenario: Paciente sin hand signature registrada

- GIVEN el paciente no tiene hand signature en su perfil (nuevo paciente)
- WHEN inicia sesión de ejercicio
- THEN el sistema captura y registra su hand signature automáticamente
- AND permite continuar sin validación

### Requirement: Dual-Stream Entry Mode

El sistema DEBE permitir modo de entrada híbrido que combine tracking por cámara con checklist manual.

#### Scenario: Switch a modo manual durante tracking

- GIVEN el paciente está en modo tracking con cámara
- WHEN hace clic en "Usar modo manual"
- THEN el sistema detiene la cámara
- AND muestra componente ChecklistManual con inputs para registrar repeticiones manualmente

#### Scenario: Registro de repetición en modo manual

- GIVEN el paciente está en modo manual
- WHEN hace clic en "+1" para registrar una flexión
- THEN el sistema incrementa el contador de repeticiones
- AND actualiza métricas (ROM, maxFlexion, maxExtension) basándose en valores introducidos manualmente

#### Scenario: Vuelve a modo cámara desde manual

- GIVEN el paciente está en modo manual
- WHEN hace clic en "Activar cámara"
- THEN el sistema reinicia el flujo de tracking con MediaPipe
- AND limpia el historial de reps manuales

### Requirement: Notificaciones Push

El sistema DEBE mostrar notificaciones push basadas en el horario de baja laboral configurado.

#### Scenario: Notificación de ejercicio pendiente

- GIVEN el paciente tiene configurado schedule de ejercicios (ej: 10:00, 16:00)
- WHEN la hora actual coincide con el schedule y no ha completado ejercicios del día
- THEN el sistema muestra notificación push "Es hora de tu sesión de rehabilitación"
- AND al hacer clic navega a /exercises

#### Scenario: Notificación de baja laboral activa

- GIVEN el paciente tiene configurado horario de baja laboral (ej: 20 Feb - 5 Mar)
- WHEN la fecha actual está dentro del rango de baja laboral
- THEN el sistema muestra banner "Estás en período de baja laboral - Ejercicios pausados"
- AND deshabilita la opción de iniciar nuevos ejercicios

#### Scenario: Notificación de retorno de baja

- GIVEN el paciente estaba en baja laboral y la fecha actual es posterior al fin de baja
- THEN el sistema muestra notificación "Tu período de baja ha terminado. ¡Reanuda tu rehabilitación!"
- AND habilita nuevamente los ejercicios

### Requirement: Enhanced ROM Measurement

El sistema DEBE calcular y mostrar ángulos MCP (Metacarpofalángicos) e IF (Interfalángicos) por separado.

#### Scenario: Mostrar ángulos MCP durante tracking

- GIVEN el sistema está procesando landmarks de la mano
- WHEN calcula el ángulo entre wrist→MCP y MCP→PIP
- THEN muestra el valor del ángulo MCP junto al dedo correspondiente
- AND actualiza en tiempo real (60fps objetivo)

#### Scenario: Mostrar ángulos IF durante tracking

- GIVEN el sistema está procesando landmarks de la mano
- WHEN calcula el ángulo entre MCP→PIP y PIP→DIP (para IF proximal)
- AND calcula el ángulo entre PIP→DIP y DIP→TIP (para IF distal)
- THEN muestra ambos valores de ángulo IF
- AND los actualiza en tiempo real

## MODIFIED Requirements

### Requirement: Exercise Session Flow

(Previously: El paciente selecciona ejercicio, luego dedos lesionados, luego inicia tracking)

El flujo de sesión DEBE incluir pasos adicionales:

1. Seleccionar ejercicio
2. Seleccionar dedos lesionados
3. **VALIDAR IDENTIDAD DEL PACIENTE** (nuevo paso)
4. Elegir modo (cámara / manual)
5. Ver demo e iniciar tracking
6. Completar sesión

#### Scenario: Flujo completo de sesión con validación

- GIVEN el paciente ha seleccionado ejercicio y dedos
- WHEN llega al paso de validación de identidad
- THEN el sistema captura hand signature
- AND muestra resultado de validación
- AND permite continuar al siguiente paso

## REMOVED Requirements

### Requirement: (Ninguno por ahora)

No se eliminan requisitos existentes. Esta es una expansión.

## Requirements Summary

| Requirement | Strength | Scenarios |
|-------------|----------|-----------|
| Hand Identity Validation | MUST | 3 |
| Dual-Stream Entry Mode | MUST | 3 |
| Notificaciones Push | SHOULD | 3 |
| Enhanced ROM Measurement | MUST | 2 |
| Exercise Session Flow | MUST | 1 |
