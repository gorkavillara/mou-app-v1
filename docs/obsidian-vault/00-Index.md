# 🖐️ Mou — Vault de proyecto

> Vault de Obsidian para gestionar la **Fase 1: Panel del Doctor + Piloto 20 pacientes**.
> Apertura: en Obsidian → *Open folder as vault* → seleccionar `docs/obsidian-vault/`.

## 🎯 Estado actual
- **Fase 0** ✅ Vista de paciente con cámara + MediaPipe (funcional, prototipo)
- **Fase 1** 🚧 Panel del doctor + piloto real con 20 pacientes
- **Deadline piloto**: viernes **2026-05-15** (próximo viernes desde hoy 2026-05-08)

## 🗂️ Mapa del vault

### Visión y contexto
- [[01-Vision-Fase1]] — qué construimos y por qué
- [[02-Decisiones-clave]] — decisiones tomadas en la reunión del 28/04
- [[notas-reuniones/2026-04-28-reunion]] — transcripción anotada

### Limpieza
- [[08-Legado-a-eliminar]] — qué borrar antes de empezar

### Diseño técnico
- [[06-Modelo-datos]] — tablas, identificación anónima, esquema Supabase
- [[09-Flujos-usuario]] — onboarding paciente vía QR, sesión de ejercicios
- [[10-Algoritmo-IA-normalizacion]] — normalización de grados (0–90°), articulaciones IF
- [[12-Convencion-angular]] — referencia angular por articulación (IA-01)

### Backlog por área
- [[03-Tareas-Backend]] — Supabase, auth doctor, APIs
- [[04-Tareas-Frontend]] — panel doctor, generador QR, vista paciente
- [[05-Tareas-IA]] — calibración de ángulos, articulaciones interfalángicas, mano animada

### Operativa
- [[07-Plan-piloto-20-pacientes]] — cronograma día a día hasta 2026-05-15
- [[11-Riesgos-y-bloqueos]] — qué nos puede tirar el piloto

## 🚦 Próxima acción
Empezar por [[08-Legado-a-eliminar]] — sin tirar el código viejo, las nuevas decisiones se mezclan con prototipos antiguos y todo se contamina.
