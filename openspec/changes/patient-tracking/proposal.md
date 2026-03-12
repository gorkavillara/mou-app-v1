# Proposal: Patient Tracking System

## Intent

Expandir el sistema de rehabilitación Mou con capacidades de tracking de pacientes que incluyen validación de identidad mediante skeletal hand tracking, sistema dual-stream (cámara + checklist manual), y notificaciones push basadas en horarios de baja laboral. El objetivo es mejorar la adherencia al tratamiento y permitir a los doctores monitorear el progreso de pacientes de forma remota.

## Scope

### In Scope
1. **Skeletal Hand Tracking** - Validación de identidad del paciente mediante comparación de landmarks de mano capturados vs. perfil registrado
2. **Medición de ROM mejorada** - Cálculo preciso de ángulos MP (Metacarpofalángicos) e IF (Interfalángicos) con visualización en tiempo real
3. **Dual-Stream Entry** - Sistema híbrido que combina tracking por cámara con checklist manual para pacientes que no pueden usar cámara
4. **Notificaciones Push** - Alertas automáticas basadas en horario de baja laboral configurado por el doctor

### Out of Scope
- Autenticación de usuarios (ya existe login hardcoded)
- Base de datos real (se mantiene mock/in-memory)
- Integración con sistemas externos de hospitals
- Envío de SMS real (solo web notifications)

## Approach

1. **Identidad mediante Hand Geometry**: Usar los 21 landmarks de MediaPipe para crear un "hand signature" único por paciente. Comparar en tiempo real durante login de sesión de ejercicio.
2. **ROM Enhancement**: Extender calculateFingerAngle para devolver ángulos MCP e IF separados. Añadir visualización de arco de movimiento en UI.
3. **Dual-Stream**: Crear componente ChecklistManual que permite registro de repeticiones sin cámara. Integrar en flujo de ejercicios como alternativa.
4. **Notification System**: Crear servicio de notificaciones que consulta schedule de ejercicios del paciente y muestra alerts cuando corresponde.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/hand-tracking.ts` | Modified | Añadir calculateMCPAngle, calculateIFAngle, createHandSignature, compareHandSignature |
| `src/components/exercises/` | New | Crear ChecklistManual, NotificationBanner, PatientIdentityValidator |
| `src/app/exercises/page.tsx` | Modified | Integrar validación de identidad,dual-stream, notificaciones |
| `src/data/patients.ts` | Modified | Añadir campos: handSignature, exerciseSchedule, lowBackSchedule |
| `src/lib/notifications.ts` | New | Sistema de notificaciones push |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Hand signature no suficientemente único | Medium | Añadir fallback a código manual si no hace match |
| Notificaciones no funcionan en Safari | Medium | Usar Notification API con fallback a UI in-app |
| Dual-stream confuse a usuarios | Low | UX clara diferenciando modo cámara vs manual |

## Rollback Plan
- Desactivar features mediante feature flags en código
- Rollback de hand-tracking.ts a versión anterior
- Eliminar componentes nuevos sin afectar existentes

## Dependencies
- @mediapipe/tasks-vision (ya instalado)
- Browser Notification API (nativo)
- Supabase client (ya configurado)

## Success Criteria
- [ ] Paciente puede completar sesión de ejercicio con validación de identidad por hand tracking
- [ ] Sistema dual-stream permite registro manual de reps cuando cámara no está disponible
- [ ] Notificaciones push aparecen según schedule configurado
- [ ] Ángulos MCP/IF se muestran correctamente durante tracking
