# Tasks: Security & Privacy - Protección de Datos Mou

## Phase 1: Infrastructure - Cifrado y Consentimiento Base

- [x] 1.1 Crear `src/lib/encryption.ts` con funciones generatePatientKey(), encrypt(), decrypt() usando crypto-js
- [x] 1.2 Crear `src/lib/consent.ts` con tipos ConsentStatus, getConsentStatus(), recordConsent(), revokeConsent()
- [x] 1.3 Añadir modelo `ConsentLog` a `prisma/schema.prisma` con campos: patientId, status, version, acceptedAt, revokedAt, ipAddress
- [x] 1.4 Añadir campo `encryptionKey` (encrypted) a modelo Patient en schema.prisma
- [x] 1.5 Ejecutar `npx prisma db push` para crear tablas

## Phase 2: Backend - API de Consentimiento

- [x] 2.1 Modificar `src/app/api/patients/route.ts` para generar y guardar clave de cifrado del paciente al primer consentimiento
- [x] 2.2 Crear `src/app/api/consent/route.ts` con endpoints POST (aceptar), DELETE (revocar), GET (estado)
- [x] 2.3 Modificar `src/app/api/sessions/route.ts` para cifrar datos antes de guardar en POST
- [x] 2.4 Modificar `src/app/api/sessions/route.ts` para descifrar datos en GET
- [x] 2.5 Actualizar `src/middleware.ts` para verificar consentimiento antes de permitir acceso a /exercises

## Phase 3: Frontend - UI de Consentimiento

- [x] 3.1 Crear `src/app/privacy/page.tsx` - página de configuración de privacidad del paciente
- [x] 3.2 Crear `src/components/privacy/ConsentBanner.tsx` - banner obligatorio cuando consentimiento no válido
- [x] 3.3 Crear `src/components/privacy/PrivacySettings.tsx` - panel de ajustes con opción de revocar
- [ ] 3.4 Modificar `src/app/onboarding/page.tsx` para incluir paso de consentimiento antes de completar registro

## Phase 4: Integración y Testing

- [x] 4.1 Verificar que exercises/page.tsx redirija a consentimiento si no hay consentimiento activo (integrado en API)
- [x] 4.2 Probar flujo completo: nuevo paciente → consentimiento → exercise → datos cifrados en BD
- [x] 4.3 Probar revocación: privacy → revocar → intentar exercise → bloqueado
- [ ] 4.4 Verificar que hand signatures se cifran correctamente

## Phase 5: Cleanup

- [x] 5.1 Eliminar cualquier código de debug o logs de desarrollo
- [x] 5.2 Verificar que todas las funciones de cifrado manejen errores correctamente
- [ ] 5.3 Documentar las variables de entorno requeridas en .env.example
