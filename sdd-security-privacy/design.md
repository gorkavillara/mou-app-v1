# Design: Security & Privacy - Protección de Datos Mou

## Technical Approach

El enfoque implementa una arquitectura de seguridad en capas que prioriza el procesamiento local (edge) para datos biométricos, con cifrado AES-256 para datos en reposo, y un flujo de consentimiento informado integrado en el onboarding.

La clave de cifrado se genera una sola vez por paciente y se almacena en el cliente (localStorage) y se transmite en cada sesión. El servidor no persiste la clave.

## Architecture Decisions

### Decision: Cifrado AES-256 con clave por paciente

**Choice**: Cada paciente tiene una clave de cifrado única (256-bit) generada al aceptar el consentimiento por primera vez.

**Alternatives considered**: 
- Clave maestra única para toda la aplicación (rechazado: compromiso afectarían todos los datos)
- Cifrado a nivel de base de datos (rechazado: no permite acceso selectivo por paciente)

**Rationale**: Si un paciente comprometido, solo sus datos quedan expuestos. La clave se regenera si el paciente revoca y vuelve a aceptar.

### Decision: Consentimiento como gate para exercises

**Choice**: El consentimiento es obligatorio y se verifica en el servidor antes de permitir cualquier sesión de exercise.

**Alternatives considered**:
- Consentimiento solo en cliente (rechazado: manipulable)
- Consentimiento opt-in por sesión (rechazado: fricción excesivo)

**Rationale**: Cumplimiento legal requiere validación centralizada. El consentimiento se registra en BD con IP y timestamp.

### Decision: Hand signatures cifradas por separado

**Choice**: Las hand signatures (para identidad de mano) se cifran independientemente de otros datos de sesión.

**Alternatives considered**:
- Un solo cifrado para todo (rechazado: no permite rotación de claves independiente)

**Rationale**: Las hand signatures son datos biométricos sensibles que pueden requerir eliminación independiente bajo GDPR "derecho al olvido".

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │ MediaPipe   │───→│ Cifrado AES │───→│ Consent UI  │    │
│  │ (Landmarks) │    │ (crypto-js) │    │ (Checkbox)  │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    │
│         │                                    │              │
│         └──────────────┬─────────────────────┘              │
│                        ↓                                     │
│              HTTPS (datos JSON + clave)                       │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│                        SERVIDOR                               │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │ Verify Consent  │───→│ Encrypt/Decrypt │                 │
│  │ (middleware)    │    │ (crypto-js)      │                 │
│  └────────┬────────┘    └────────┬────────┘                 │
│           ↓                       ↓                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    PostgreSQL                            ││
│  │  - sessions (datos cifrados)                            ││
│  │  - patient_hand_signatures (cifrados)                   ││
│  │  - consent_logs (sin cifrar - auditoría)                ││
│  └─────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/encryption.ts` | Create | Funciones encrypt/decrypt con AES-256 |
| `src/lib/consent.ts` | Create | Lógica de verificación de consentimiento |
| `src/middleware.ts` | Modify | Agregar verificación de consentimiento |
| `src/app/api/sessions/route.ts` | Modify | Cifrar datos antes de guardar |
| `src/app/api/patients/route.ts` | Modify | Manejar generación de clave de paciente |
| `prisma/schema.prisma` | Modify | Añadir modelo ConsentLog y campo encryptedKey |
| `src/app/onboarding/page.tsx` | Modify | Agregar paso de consentimiento |
| `src/app/privacy/page.tsx` | Create | Página de configuración de privacidad |
| `src/components/privacy/ConsentBanner.tsx` | Create | Banner de consentimiento obligatorio |
| `src/components/privacy/PrivacySettings.tsx` | Create | Panel de ajustes de privacidad |

## Interfaces / Contracts

```typescript
// src/lib/encryption.ts
export function generatePatientKey(): string
export function encrypt(data: string, key: string): string
export function decrypt(ciphertext: string, key: string): string

// src/lib/consent.ts
export type ConsentStatus = 'ACTIVE' | 'REVOKED' | 'PENDING' | 'EXPIRED'

export interface ConsentLog {
  id: string
  patientId: string
  status: ConsentStatus
  version: string
  acceptedAt: Date
  revokedAt?: Date
  ipAddress: string
  userAgent: string
}

export async function getConsentStatus(patientId: string): Promise<ConsentStatus>
export async function recordConsent(patientId: string, version: string, ipAddress: string): Promise<ConsentLog>
export async function revokeConsent(patientId: string, ipAddress: string): Promise<ConsentLog>
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Funciones encrypt/decrypt | Tests con datos conocidos, verificar cifrado |
| Unit | Consent logic | Mock de base de datos, verificar transiciones de estado |
| Integration | API de sesiones con cifrado | Envío de datos reales, verificar BD cifrada |
| E2E | Flujo de consentimiento | Playwright: registro → consentimiento → exercises |

## Migration / Rollback

**Migration requerida**: Añadir columna `consent_logs` a la tabla de pacientes vía Prisma migrate.

**Rollback**: 
1. Flag `ENABLE_ENCRYPTION=false` deshabilita cifrado temporalmente
2. Script de migración para descifrar datos existentes
3. Limpiar cache de consentimiento en cliente

## Open Questions

- [ ] ¿La clave del paciente debe sincronizarse entre dispositivos? (MVP: solo localStorage)
- [ ] ¿Cómo manejar la recuperación de clave si el paciente limpia datos del navegador?
- [ ] ¿Tiempo de expiración del consentimiento? (Propuesto: 12 meses)
