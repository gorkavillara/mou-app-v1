# Tasks: Patient Tracking System

## Phase 1: Foundation - Hand Tracking Extensions

- [x] 1.1 Añadir calculateMCPAngle(landmarks, finger) en src/lib/hand-tracking.ts - calcula ángulo entre wrist→MCP y MCP→PIP
- [x] 1.2 Añadir calculateIFAngle(landmarks, finger) en src/lib/hand-tracking.ts - calcula ángulo entre MCP→PIP y PIP→DIP (IF proximal)
- [x] 1.3 Añadir createHandSignature(landmarks) en src/lib/hand-tracking.ts - genera objeto HandSignature con 21 puntos + metadata
- [x] 1.4 Añadir compareHandSignature(stored: HandSignature, captured: Point[]) en src/lib/hand-tracking.ts - devuelve similarity 0-100%
- [x] 1.5 Exportar tipos HandSignature y FingerAngles desde src/lib/hand-tracking.ts

## Phase 2: Core Implementation - Components

- [x] 2.1 Crear src/lib/notifications.ts con funciones: requestNotificationPermission, checkAndNotify, isPatientOnLowBack
- [x] 2.2 Crear src/components/exercises/HandIdentityValidator.tsx - UI que captura hand signature, muestra resultado de validación, permite fallback con código manual
- [x] 2.3 Crear src/components/exercises/ChecklistManual.tsx - UI con botones +1/-1 para flexión/extensión, inputs para valores manuales, historial de reps
- [x] 2.4 Crear src/components/exercises/NotificationBanner.tsx - UI para mostrar notificaciones push, banner de baja laboral

## Phase 3: Integration - Exercises Page

- [x] 3.1 Modificar src/data/patients.ts - añadir campos handSignature, exerciseSchedule, lowBackSchedule a tipo Patient
- [x] 3.2 Modificar src/app/exercises/page.tsx - integrar HandIdentityValidator después de finger-select, antes de demo
- [x] 3.3 Añadir selector modo camera/manual en página de ejercicios
- [x] 3.4 Integrar ChecklistManual como alternativa cuando modo = manual
- [x] 3.5 Añadir NotificationBanner al header de ejercicios
- [ ] 3.6 Actualizar MetricsGrid para mostrar ángulos MCP e IF separados

## Phase 4: Testing

- [ ] 4.1 Verificar que createHandSignature devuelve 21 puntos normalizados
- [ ] 4.2 Verificar que compareHandSignature con mismos landmarks devuelve >95%
- [x] 4.3 Verificar que HandIdentityValidator muestra estado "validado" cuando similarity >= 85%
- [x] 4.4 Verificar que ChecklistManual incrementa contador al hacer click en +1
- [x] 4.5 Verificar que NotificationBanner muestra alerta cuando paciente está en fecha de baja

## Phase 5: Polish

- [ ] 5.1 Verificar que linter pasa (npm run lint)
- [x] 5.2 Verificar que TypeScript compila sin errores (npm run build o tsc)
- [ ] 5.3 Testing manual: hacer flow completo de ejercicio con validación de identidad

---

## Implementation Order

1. **Phase 1** (hand-tracking.ts) - Dependencias base para el resto
2. **Phase 2** (notifications.ts + componentes) - UI y lógica independientes
3. **Phase 3** (page.tsx + patients.ts) - Integración final
4. **Phase 4** - Tests unitarios de funciones críticas
5. **Phase 5** - Verificación y polish
