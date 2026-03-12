# Proposal: Security & Privacy - Protección de Datos en Mou (MedTech)

## Intent

Mou es una plataforma MedTech de rehabilitación de mano que procesa datos biométricos sensibles (landmarks de mano, ángulos de dedos, métricas de movimiento). Este cambio implementa un marco integral de seguridad y privacidad que garantiza:

1. **Procesamiento local (Edge Computing)**: Los frames de video se procesan en el navegador del paciente, sin transmitir ni almacenar video.
2. **Cifrado de datos sensibles**: Los datos de sesiones, métricas de rehabilitación y hand signatures se cifran con AES-256.
3. **Consentimiento informado digital**: Validación legal obligatoria durante onboarding.

El marco cumple con GDPR, HIPAA (referencia), y regulaciones españolas de protección de datos sanitarios.

## Scope

### In Scope
- Implementar pipeline de procesamiento edge (MediaPipe en cliente)
- Sistema de cifrado AES-256 para datos en reposo y tránsito
- Flujo de consentimiento informado con validación de aceptación
- Componente UI de configuración de privacidad
- Modelo de base de datos para consentimientos

### Out of Scope
- Autenticación de dos factores (2FA) - será otro change
- Auditoría de accesos completa - será otro change
- Copias de seguridad cifradas externas - será otro change

## Approach

**Arquitectura Zero-Trust con Edge Processing:**

```
[Paciente] → [Navegador] → [Procesamiento Local MediaPipe]
                ↓
           Landmarks (JSON)
                ↓
    [Servidor API] → [Cifrado AES-256] → [PostgreSQL]
```

- **Edge**: MediaPipe procesa frames localmente, solo envía landmarks (no video)
- **Transmisión**: HTTPS obligatorio, headers de seguridad
- **Almacenamiento**: Datos cifrados con clave por paciente
- **Consentimiento**: Checkbox legal con timestamp e IP (no vinculante)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/encryption.ts` | New | Módulo de cifrado AES-256 |
| `src/app/api/sessions/route.ts` | Modified | Cifrar datos de sesión antes de guardar |
| `src/components/privacy/` | New | Componentes de configuración de privacidad |
| `src/app/onboarding/page.tsx` | Modified | Agregar flujo de consentimiento |
| `prisma/schema.prisma` | Modified | Añadir modelo ConsentLog |
| `src/app/exercises/page.tsx` | Modified | Verificar consentimiento antes de iniciar sesión |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Degradación de performance por cifrado | Low | Cifrado AES-256 es rápido, usar Web Workers |
| Pérdida de datos si se pierde clave | Medium | Backup de clave en entorno del usuario |
| Consentimiento no válido legalmente | Low | Usar texto legal aprobado, timestamp, IP |

## Rollback Plan

1. Deshabilitar flag `ENABLE_ENCRYPTION` en `.env`
2. Revertir cambios en `src/app/api/sessions/route.ts`
3. Ejecutar migración para descifrar datos existentes
4. Deshacer cambios en onboarding (consentimiento sigue disponible)

## Dependencies

- `crypto-js` para cifrado AES-256 en cliente y servidor
- Prisma existente para modelos de datos

## Success Criteria

- [ ] Paciente no puede iniciar exercises sin aceptar consentimiento
- [ ] Datos de sesión almacenados cifrados en BD
- [ ] Hand signatures cifradas con clave única por paciente
- [ ] UI de privacidad muestra estado de consentimiento
- [ ] Logs de consentimiento guardados con timestamp
