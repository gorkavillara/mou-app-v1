# Tasks: Doctor Dashboard Expansion

## Phase 1: Foundation - Types y Utilidades

- [x] 1.1 Crear `src/types/doctor.ts` con tipos: CohortPatient, Alert, DeviationData
- [x] 1.2 Crear `src/lib/doctor-utils.ts` con funciones: calculateDeviation, generateAlerts, getPatientStatus
- [x] 1.3 Crear `src/data/mock-cohort.ts` con datos de cohortes (extiende patients.ts)

## Phase 2: Componentes del Dashboard

- [x] 2.1 Crear `src/components/doctor/PatientCard.tsx` - Card individual con métricas
- [x] 2.2 Crear `src/components/doctor/CohorteGrid.tsx` - Grid de pacientes
- [x] 2.3 Crear `src/components/doctor/DeviationChart.tsx` - Gráfico comparativo ROM vs baremo 50 días
- [x] 2.4 Crear `src/components/doctor/AlertManager.tsx` - Panel de alertas filtrables

## Phase 3: API Module para Mutuas

- [x] 3.1 Crear `src/lib/doctor-api.ts` - Funciones reutilizables para datos de pacientes
- [x] 3.2 Crear `src/app/api/mutuas/pacientes/route.ts` - GET lista pacientes
- [x] 3.3 Crear `src/app/api/mutuas/pacientes/[id]/progreso/route.ts` - GET progreso por paciente

## Phase 4: Integración en Doctor Dashboard

- [x] 4.1 Modificar `src/app/doctor/page.tsx` - Reorganizar layout con nuevas secciones
- [x] 4.2 Integrar CohorteGrid en columna izquierda
- [x] 4.3 Integrar DeviationChart en sección central
- [x] 4.4 Integrar AlertManager en panel derecho

## Phase 5: Verificación

- [x] 5.1 Ejecutar `npm run lint` y corregir errores
- [ ] 5.2 Verificar que dashboard carga sin errores en navegador
- [ ] 5.3 Verificar que gráficos muestran datos correctamente
