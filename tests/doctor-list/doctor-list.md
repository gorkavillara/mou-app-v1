### E2E Tests: Doctor patient list

**Suite ID:** `DOCTOR-LIST-E2E`
**Feature:** `/doctor` listado de pacientes (F-03 + F-04).

---

## Test Case: `DOCTOR-LIST-E2E-001` — landing renderiza toolbar y lista

**Priority:** `critical`

**Tags:** @e2e · @doctor-list

**Description:** Visitar `/doctor` con sesión muestra el heading "Pacientes", el buscador, los filtros de estado y el botón "+ Nuevo paciente". Captura `doctor-list`.

### Flow Steps:
1. `/doctor` con sesión activa.
2. Verificar heading.
3. Verificar `searchInput`, `statusAll/Activos`, botón nuevo paciente.
4. `snap('doctor-list')`.

---

## Test Case: `DOCTOR-LIST-E2E-002` — alta de paciente y navegación al detalle

**Priority:** `critical`

**Description:** Abrir el modal "Nuevo paciente", rellenar el form y aterrizar en `/doctor/pacientes/<uuid>`. Capturas: `new-patient-dialog` y `patient-detail-after-create`.

### Flow Steps:
1. `/doctor`.
2. Click en "+ Nuevo paciente". Verificar dialog visible. Captura.
3. Rellenar `external_id` (`generatePatientId()`), `pathology = flexor`. Submit.
4. Esperar URL `/doctor/pacientes/<uuid>`.
5. Verificar h1 con el ID. Captura final.

### Notes:
- Cada test usa su propio `external_id` único — el modelo es anónimo, jamás se guardan datos personales.

---

## Test Case: `DOCTOR-LIST-E2E-003` — duplicado da error 409 amigable

**Priority:** `high`

**Description:** Crear paciente, volver a la lista, intentar crear otro con el mismo `external_id` debe mostrar el mensaje "Ya tienes un paciente con ese ID. Usa otro identificador.". Captura `new-patient-dialog-duplicate-error`.

---

## Test Case: `DOCTOR-LIST-E2E-004` — buscador con URL params

**Priority:** `medium`

**Description:** Tipear en el buscador y `Enter` aplica el query string `?search=`. Si no hay resultados, ver "Sin resultados".
