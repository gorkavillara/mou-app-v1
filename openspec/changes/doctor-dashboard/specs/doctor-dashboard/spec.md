# Delta for Doctor Dashboard

## Purpose

Expander el dashboard del médico con capacidades de visualización de cohortes, métricas de desviación, alertas automáticas e interoperabilidad API para integración con mutuas.

## ADDED Requirements

### Requirement: Cohorte de Pacientes

El sistema DEBE mostrar una lista de pacientes asignados al doctor con su información básica: nombre, diagnóstico, última sesión, y métricas clave (adherencia, IFRM).

#### Scenario: Ver lista de pacientes activos

- GIVEN el doctor tiene pacientes asignados con estado ACTIVE
- WHEN el dashboard carga
- THEN se muestra un grid con cards de pacientes mostrando: nombre, diagnóstico, adherencia %, última fecha de sesión

#### Scenario: Estado sin pacientes

- GIVEN el doctor no tiene pacientes asignados
- WHEN el dashboard carga
- THEN se muestra mensaje "No hay pacientes asignados"

### Requirement: Métricas de Desviación ROM

El sistema DEBE mostrar gráficos comparativos del rango de movimiento (ROM) de cada paciente versus el baremo de referencia de 50 días.

#### Scenario: Ver gráfico de desviación individual

- GIVEN el paciente tiene sesiones registradas
- WHEN se selecciona un paciente
- THEN se muestra gráfico de líneas con: progreso real del paciente vs objetivo 50 días

#### Scenario: Ver gráfico de desviación global

- GIVEN hay datos de múltiples pacientes
- WHEN se visualiza la vista de cohorte
- THEN se muestra gráfico agregado de desviación promedio por grupo

### Requirement: Sistema de Alertas Automáticas

El sistema DEBE identificar y mostrar alertas para pacientes cuyo ROM esté por debajo del umbral esperado.

#### Scenario: Alerta por bajo rendimiento

- GIVEN un paciente tiene menos de 3 sesiones en la última semana O promedio de ROM < 50°
- WHEN se procesan los datos de sesiones
- THEN se genera alerta automática de tipo "ROM_INSUFICIENTE"

#### Scenario: Ver panel de alertas

- GIVEN existen alertas activas
- WHEN el doctor visualiza el dashboard
- THEN se muestra panel de alertas ordenadas por criticidad (CRITICAL > WARNING > INFO)

### Requirement: Interoperabilidad API para Mutuas

El sistema DEBE exponer endpoints API que permitan a mutuas/aseguradoras obtener información de pacientes.

#### Scenario: Endpoint de lista de pacientes

- GIVEN la mutua envía solicitud GET a /api/mutuas/pacientes
- WHEN la solicitud incluye header de autenticación válido
- THEN devuelve JSON con: id, nombre, diagnóstico, última fecha de sesión, métricas de progreso

#### Scenario: Endpoint de progreso por paciente

- GIVEN la mutua envía solicitud GET a /api/mutuas/pacientes/{id}/progreso
- WHEN el paciente existe y tiene datos
- THEN devuelve JSON con: historial de sesiones, ROM promedio, adherencia, desviación vs objetivo

## MODIFIED Requirements

### Requirement: Dashboard del Doctor

(Previously: Mostraba stats básicos, heatmap de adherencia y gráfico de biomecánica)

El dashboard del doctor DEBE integrar: vista de cohortes, gráficos de desviación, panel de alertas y acceso a la API de mutuas.

#### Scenario: Carga del dashboard expandido

- GIVEN el doctor inicia sesión
- WHEN accede a /doctor
- THEN se carga la nueva interfaz con las 4 secciones: Stats, Cohortes, Métricas, Alertas

## REMOVED Requirements

(No hay requisitos eliminados)

## Implementation Notes

- Usar Recharts para los gráficos (ya instalado en proyecto)
- Datos mock en src/data/patients.ts como base
- API module en src/lib/doctor-api.ts para lógica reutilizable
