# Proposal: Doctor Dashboard - Sistema de Gestión de Pacientes y Rehabilitación

## Intent

El objetivo es expandir el dashboard del doctor existente (src/app/doctor/page.tsx) con cuatro capacidades críticas:
1. **Visualización de cohortes en tiempo real** - Seguimiento de múltiples pacientes con métricas de grupo
2. **Métricas de desviación** - Gráficos comparativos vs baremo de referencia de 50 días
3. **Gestión de alertas automáticas** - Identificación de pacientes con ROM insuficiente
4. **Interoperabilidad API** - Módulo de integración con mutuas/aseguradoras

## Scope

### In Scope
- Dashboard de cohortes con vista de pacientes activos
- Gráficos de desviación ROM vs baremo 50 días por paciente y global
- Sistema de alertas automáticas por bajo rendimiento
- API module para integración externa (mutuas)

### Out of Scope
- Sistema de notificaciones push (futuro)
- Integración real con mutuas (solo mock/skeleton)
- Base de datos avanzada - usar datos mock existentes

## Approach

Extender src/app/doctor/page.tsx con nuevos componentes en src/components/doctor/:
- CohortView: Grid de pacientes con métricas resumidas
- DeviationChart: Gráficos comparativos usando Recharts
- AlertManager: Panel de alertas filtrables
- ApiModule: Endpoints en src/app/api/ para integración

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/doctor/page.tsx` | Modified | Integrar nuevos componentes |
| `src/components/doctor/` | New | Nuevos componentes del dashboard |
| `src/lib/doctor-api.ts` | New | Módulo de API para mutuas |
| `src/app/api/mutuas/` | New | Endpoints de integración |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Complejidad UI con muchos datos | Medium | Diseño modular con tabs/secciones |
| Datos mock insuficientes | Low | Estructurar datos como si fueran reales |

## Rollback Plan

- Revertir cambios en src/app/doctor/page.tsx
- Eliminar carpeta src/components/doctor/
- Eliminar src/lib/doctor-api.ts

## Dependencies

- Ninguna dependencia externa nueva
- Recharts ya está instalado (proyecto usa)

## Success Criteria

- [ ] Dashboard muestra cohortes con datos de pacientes
- [ ] Gráficos de desviación muestran comparativa 50 días
- [ ] Alertas automáticas se generan para pacientes con ROM bajo
- [ ] API module devuelve datos en formato JSON estándar
