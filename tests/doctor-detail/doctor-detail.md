### E2E Tests: Doctor patient detail

**Suite ID:** `DOCTOR-DETAIL-E2E`
**Feature:** `/doctor/pacientes/[id]` (F-05 + F-06 + F-07).

---

## Test Case: `DOCTOR-DETAIL-E2E-001` — vista del detalle recién creado

**Priority:** `critical`

**Tags:** @e2e · @doctor-detail

**Description:** Tras crear un paciente, el detalle carga con su `external_id`, el badge "Activo", la sección "Acceso del paciente" (QR + URL) y el botón "Finalizar rehabilitación". Captura `patient-detail-fresh`.

---

## Test Case: `DOCTOR-DETAIL-E2E-002` — alta de prescripción con preview

**Priority:** `critical`

**Description:** Abrir "Nueva prescripción", introducir 3×20 reps, 4 sesiones/día, 14 días → la previsualización muestra `3 360` reps totales; al guardar el dialog cierra y el detalle muestra la prescripción. Capturas: `new-prescription-dialog`, `patient-detail-with-prescription`.

---

## Test Case: `DOCTOR-DETAIL-E2E-003` — alta clínica del paciente

**Priority:** `high`

**Description:** Pulsar "Finalizar rehabilitación" → confirmar → el detalle pasa a estado "Dado de alta" y el botón desaparece. Captura `patient-detail-discharged`.

### Notes:
- La acción es idempotente desde la API: re-ejecutarla devuelve `already_discharged: true` (B-10).
