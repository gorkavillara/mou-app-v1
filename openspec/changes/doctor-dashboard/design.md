# Design: Doctor Dashboard Expansion

## Technical Approach

Extender el dashboard existente del doctor (`src/app/doctor/page.tsx`) añadiendo 4 nuevos componentes modulares que se integran en una interfaz reorganizada. Usar datos de `src/data/patients.ts` como mock base, con estructura preparada para migración a Supabase.

## Architecture Decisions

### Decision: Estructura de Componentes

**Choice**: Crear carpeta `src/components/doctor/` con componentes independientes
**Alternatives considered**: Todo en page.tsx, usar patrones existentes en `src/components/dashboard/`
**Rationale**: Mantener separación de responsabilidades y seguir patrón del proyecto (componentes en carpetas por función)

### Decision: Gráficos de Desviación

**Choice**: Usar Recharts con LineChart para comparativa vs baremo
**Alternatives considered**: Chart.js, barras apiladas
**Rationale**: Recharts ya está instalado y usado en el proyecto. LineChart es ideal para series temporales

### Decision: Sistema de Alertas

**Choice**: Componente AlertManager con lógica de generación en hook dedicado
**Alternatives considered**: Generar alertas en el servidor, usar store global
**Rationale**: Mantiene consistencia con patrón del proyecto (hooks para lógica de datos)

### Decision: API Module

**Choice**: Módulo en `src/lib/doctor-api.ts` + endpoints en `src/app/api/mutuas/`
**Alternatives considered**: Todo en una ruta API, usar Route Handlers directamente
**Rationale**: Separación de concerns - lógica reutilizable en lib, HTTP en API routes

## Data Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  patients.ts    │───→│  useDoctorData   │───→│  CohorteGrid    │
│  (mock data)    │    │  (hook)          │    │  (component)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                      │
                                                      ▼
                        ┌──────────────────┐    ┌─────────────────┐
                        │  AlertManager    │←───│  DeviationChart │
                        │  (alerts logic)  │    │  (recharts)     │
                        └──────────────────┘    └─────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/doctor/CohorteGrid.tsx` | Create | Grid de pacientes con métricas |
| `src/components/doctor/DeviationChart.tsx` | Create | Gráficos comparativos ROM vs baremo |
| `src/components/doctor/AlertManager.tsx` | Create | Panel de alertas automáticas |
| `src/components/doctor/PatientCard.tsx` | Create | Card individual de paciente |
| `src/lib/doctor-api.ts` | Create | Funciones de API para mutuas |
| `src/app/api/mutuas/pacientes/route.ts` | Create | Endpoint lista pacientes |
| `src/app/api/mutuas/pacientes/[id]/progreso/route.ts` | Create | Endpoint progreso por paciente |
| `src/app/doctor/page.tsx` | Modify | Integrar nuevos componentes |

## Interfaces / Contracts

```typescript
// Tipos para el doctor dashboard
interface CohortPatient {
  id: string;
  name: string;
  diagnosis: string;
  lastSession: string;
  adherence: number;
  ifrm: number;
  romAvg: number;
  status: 'active' | 'warning' | 'critical';
}

interface Alert {
  id: string;
  patientId: string;
  patientName: string;
  type: 'ROM_INSUFICIENTE' | 'BAJA_ADHERENCIA' | 'SIN_SESIONES';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  createdAt: Date;
}

interface DeviationData {
  day: number;
  paciente: number;
  objetivo: number;
  desviacion: number;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Lógica de generación de alertas | Test de funciones en doctor-api.ts |
| Unit | Cálculos de desviación | Test de funciones utilitarias |
| Integration | Endpoints API | Test con mocks de requests |
| Visual | Componentes renderizados | Revisión manual con datos mock |

## Migration / Rollout

No migration required. Los datos actuales de `src/data/patients.ts` se usan como mock. La integración con Supabase será transparente cuando esté lista.

## Open Questions

- [ ] ¿Necesitamos autenticación real para endpoints de mutuas? (Por ahora: mock)
- [ ] ¿Frecuencia de actualización de datos en tiempo real? (Por ahora: carga en página)
