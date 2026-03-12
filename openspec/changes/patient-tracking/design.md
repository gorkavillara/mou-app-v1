# Design: Patient Tracking System

## Technical Approach

Extender el sistema de ejercicios con tres componentes principales: (1) hand signature para validación de identidad usando los 21 landmarks de MediaPipe, (2) modo dual que alterna entre tracking por cámara y entrada manual, (3) sistema de notificaciones push integrado con el flujo de ejercicios. La implementación usa el hand tracking existente como base y añade las funciones necesarias.

## Architecture Decisions

### Decision: Hand Signature Storage Format

**Choice**: Guardar hand signature como array de 21 puntos normalizados (x, y, z) más metadata (distancia media entre dedos, ratio palm/finger)
**Alternatives considered**: Hash crypto de landmarks, embedding vectorial, template matching completo
**Rationale**: Los 21 puntos normalizados proporcionan suficiente información discriminativa mientras se mantiene simple la comparación. El cálculo de similarity es O(n) simple sin dependencias ML adicionales.

### Decision: Dual-Stream State Management

**Choice**: Estado local en componente Exercises con modo 'camera' | 'manual'
**Alternatives considered**: Global state (Zustand/Context), URL params, localStorage
**Rationale**: El estado ya existe en Exercises page (phase, metrics, etc.). Añadir un campo más mantiene consistencia con el patrón existente del proyecto.

### Decision: Notification Permission Strategy

**Choice**: Request permission on first visit to dashboard, show in-app fallback if denied
**Alternatives considered**: Request on each notification need, use service workers for web push
**Rationale**: Notification API es simple y no requiere server setup. Service workers son overkill para MVP prototype.

## Data Flow

```
[Login] → [Patient Profile] → [Exercises] → [Identity Validation]
                                                    ↓
                                            [Camera / Manual]
                                                    ↓
                                            [Session Metrics]
                                                    ↓
                                        [Notifications Check]
```

**Hand Signature Flow**:
```
MediaPipe Landmarks (21 pts) → createHandSignature() → compareHandSignature(stored, captured) → similarity %
```

**Notification Flow**:
```
App Init → Check Patient Schedule → Check Current Time → Show NotificationBanner if due
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/hand-tracking.ts` | Modify | Añadir calculateMCPAngle, calculateIFAngle, createHandSignature, compareHandSignature |
| `src/lib/notifications.ts` | Create | RequestPermission, CheckSchedule, ShowNotification |
| `src/components/exercises/HandIdentityValidator.tsx` | Create | UI para validación de identidad |
| `src/components/exercises/ChecklistManual.tsx` | Create | UI para entrada manual de repeticiones |
| `src/components/exercises/NotificationBanner.tsx` | Create | UI para mostrar notificaciones push |
| `src/app/exercises/page.tsx` | Modify | Integrar Identity Validation, Dual-Stream, Notifications |
| `src/data/patients.ts` | Modify | Añadir handSignature, exerciseSchedule, lowBackSchedule |

## Interfaces / Contracts

```typescript
// hand-signature.ts (nuevas funciones)

type HandSignature = {
  landmarks: Point[];  // 21 puntos normalizados
  metadata: {
    avgFingerLength: number;
    palmWidth: number;
    handRatio: number;
  };
  createdAt: number;
};

function createHandSignature(landmarks: Point[]): HandSignature

function compareHandSignature(
  stored: HandSignature, 
  captured: Point[]
): number  // similarity 0-100

// notifications.ts (nuevo módulo)

type ExerciseSchedule = {
  times: string[];  // ["10:00", "16:00"]
  days: number[];   // [1,2,3,4,5] - días de la semana
};

type LowBackSchedule = {
  startDate: string;  // "2025-02-20"
  endDate: string;    // "2025-03-05"
};

function requestNotificationPermission(): Promise<boolean>
function checkAndNotify(
  patient: Patient, 
  onNotify: (message: string) => void
): void
function isPatientOnLowBack(patient: Patient): boolean
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | compareHandSignature similarity calculation | Mock landmarks, verificar % returned |
| Unit | isPatientOnLowBack date logic | Test con fechas antes/durante/después |
| Integration | HandIdentityValidator renders | Snapshot test |
| Integration | ChecklistManual increments counter | User event test |

## Migration / Rollback

No migration required - datos mock en memoria.

Feature flag implícito mediante checks de `if (patient.handSignature)` - si no existe, se salta validación.

## Open Questions

- [ ] ¿Qué threshold de similitud es óptimo? 85% es guess inicial - puede necesitar tuning
- [ ] ¿Frequency de notificaciones - solo cuando está scheduled, o reminder cada X minutos?
- [ ] ¿Persistencia de hand signature? Ahora es mock - ¿localStorage o Supabase?
