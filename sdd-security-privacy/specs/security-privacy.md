# Delta for Security & Privacy

## ADDED Requirements

### Requirement: Edge Computing - Procesamiento Local

El sistema DEBE procesar todos los frames de video utilizando MediaPipe exclusivamente en el navegador del paciente. El servidor NUNCA debe recibir video, audio, o streams de imagen.

#### Scenario: Inicio de sesión de ejercicio

- GIVEN El paciente está en la página de exercises
- WHEN Inicia una sesión de ejercicio
- THEN Los landmarks se calculan localmente en el navegador
- AND Solo los datos JSON de landmarks se transmiten al servidor

#### Scenario: Fallback cuando no hay cámara

- GIVEN El paciente no tiene cámara disponible
- WHEN Intenta iniciar sesión de ejercicio
- THEN El sistema muestra error indicando que se requiere cámara
- AND No se transmite ninguna solicitud al servidor

### Requirement: Almacenamiento Cifrado AES-256

El sistema DEBE cifrar todos los datos sensibles del paciente antes de almacenarlos en la base de datos. Esto incluye: métricas de sesión, hand signatures, y datos de progreso.

#### Scenario: Guardado de datos de sesión

- GIVEN El paciente completa una sesión de ejercicio
- WHEN Los datos de sesión se envían al servidor
- THEN Los datos se cifran con AES-256 antes de escribir en PostgreSQL
- AND Los datos cifrados se almacenan en la columna correspondiente

#### Scenario: Lectura de datos cifrados

- GIVEN Un médico solicita ver el historial de un paciente
- WHEN El servidor retrieves datos de la base de datos
- THEN Los datos se descifran antes de enviarlos al cliente
- AND El cliente muestra los datos en texto claro

#### Scenario: Hand signature cifrada

- GIVEN El paciente crea una hand signature para validación
- WHEN Los landmarks se guardan
- THEN Se cifran con la clave del paciente usando AES-256
- AND Solo pueden descifrarse con la misma clave

### Requirement: Consentimiento Informado Digital

El sistema DEBE obtener y registrar el consentimiento informado del paciente antes de permitir el acceso a las funcionalidades de exercise tracking. El consentimiento debe incluir: aceptación de políticas, timestamp, y versión del documento legal.

#### Scenario: Onboarding sin consentimiento

- GIVEN Un nuevo paciente accede a la aplicación
- WHEN Intenta acceder a la página de exercises
- THEN Se redirige a la página de consentimiento
- AND No puede proceder sin aceptar los términos

#### Scenario: Aceptación de consentimiento

- GIVEN El paciente está en la página de consentimiento
- WHENHace clic en "Acepto los términos" y confirma
- THEN Se registra un ConsentLog con: patientId, timestamp, ipAddress, version
- AND Se crea una clave de cifrado única para el paciente
- AND Puede acceder a exercises

#### Scenario: Revocación de consentimiento

- GIVEN Un paciente ha aceptado previamente el consentimiento
- WHEN Accede a configuración de privacidad y revoca
- THEN Se registra un nuevo ConsentLog con status=REVOKED
- AND Los datos existentes se marcan como no accesibles para nuevos ejercicios
- AND Se permite reanudar si vuelve a aceptar

#### Scenario: Actualización de políticas

- GIVEN El sistema actualiza la versión del documento legal
- WHEN Un paciente existente inicia sesión
- THEN Se detecta que su consentimiento tiene versión antigua
- AND Se muestra modal solicitando nueva aceptación
- AND No puede proceder hasta aceptar

## MODIFIED Requirements

### Requirement: Sesión de Ejercicio Existente

(Previously: El sistema permite iniciar sesiones de exercise sin verificación de consentimiento)

El sistema DEBE verificar el estado de consentimiento válido antes de permitir el inicio de cualquier sesión de exercise. Si el consentimiento está vencido o no existe, el flujo debe dirigir al paciente a la página de consentimiento.

#### Scenario: Intento de ejercicio sin consentimiento válido

- GIVEN El paciente tiene consentimiento vencido o no existe
- WHEN Intenta iniciar una sesión de exercise
- THEN Se muestra pantalla de consentimiento obligatorio
- AND No se carga el componente de tracking de mano
- AND El conteo de repeticiones está deshabilitado

## REMOVED Requirements

### Requirement: Almacenamiento de Video

(Reason: El proyecto ya implementa procesamiento local con MediaPipe. Esta requirement clarifica que nunca se debe almacenar video.)

El sistema NO DEBE almacenar video, audio, o imágenes del paciente en ningún momento. Esta restricción aplica a todas las capas de la aplicación.
