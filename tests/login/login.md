### E2E Tests: Login

**Suite ID:** `LOGIN-E2E`
**Feature:** Acceso del doctor al panel.

---

## Test Case: `LOGIN-E2E-001` — `/` redirige a `/login` sin sesión

**Priority:** `critical`

**Tags:**
- type → @e2e
- feature → @login

**Description:** Visitar la home estando deslogueado debe llevar a `/login`.

**Preconditions:** ninguna sesión activa.

### Flow Steps:
1. Abrir `/`.
2. Esperar a que la URL sea `/login`.
3. Capturar pantalla `login-empty`.

### Expected Result:
- URL final coincide con `/login`.
- Se ve el formulario con título "Mou".

---

## Test Case: `LOGIN-E2E-002` — error con credenciales inválidas

**Priority:** `high`

**Description:** Al introducir credenciales que no existen, el formulario muestra el mensaje "Credenciales incorrectas. Inténtalo de nuevo." en una caja roja.

### Flow Steps:
1. `/login`.
2. Rellenar email y password con valores inválidos.
3. Pulsar "Iniciar sesión".
4. Esperar caja roja.
5. Capturar `login-invalid-credentials`.

### Expected Result:
- Caja roja visible con el texto esperado.
- URL sigue en `/login` (no hay navegación a `/doctor`).

---

## Test Case: `LOGIN-E2E-003` — botón deshabilitado mientras falten campos

**Priority:** `medium`

**Description:** El botón submit no se habilita hasta tener email y password.

### Flow Steps:
1. `/login`.
2. Verificar que el botón está disabled.
3. Rellenar email → sigue disabled.
4. Rellenar password → enabled.

---

## Test Case: `LOGIN-E2E-004` — `/doctor` sin sesión redirige con `next`

**Priority:** `critical`

**Description:** El middleware debe redirigir a `/login?next=%2Fdoctor` si se pide `/doctor` sin sesión.

### Flow Steps:
1. Abrir `/doctor`.
2. Verificar que la URL final contiene `next=%2Fdoctor`.
