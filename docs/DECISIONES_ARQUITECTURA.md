# MOU - Decisiones de Arquitectura de Base de Datos

## Fecha: 7 Marzo 2026

## Jerarquía de Usuarios

```
ADMIN (Tú/Socio)
  └─> MUTUA (Aseguradora/Centro)
        ├─> MÉDICO (Dashboard + Audio + Notas + Tareas)
        └─> PACIENTE (App móvil - prototipo existente)
```

## Entidades Principales

### 1. ADMIN
- Control total del sistema
- Reportes globales
- Alta de Mutuas

### 2. MUTUA (Insurance)
- name, slug, logo, contactEmail, phone, address
- Relación 1:N con pacientes
- Relación N:N con médicos ( InsuranceDoctor )

### 3. MÉDICO (Doctor)
- name, email, specialization, licenseNumber, phone, avatar
- Pertenece a varias mutuas (N:N)
- Dashboard con pacientes de múltiples mutuas
- **Audio Recording** - Grabar sesiones con pacientes
- **Session Notes** - Notas de sesión
- **Tasks** - Tareas para pacientes

### 4. PACIENTE (Patient)
- Pertenece a una mutua
- Asignado a uno o varios médicos
- Sesiones de ejercicio (tracking de mano)
- Métricas históricas: IFRM, adherencia, dolor

## Entidades de Sesión

### Session (Ejercicio/Rehabilitación)
- Tracking de mano con MediaPipe
- Métricas: ROM, maxFlexion, maxExtension, repeticiones
- Estado de dedos: normal, injured, amputated

### AudioRecording (del Médico)
- patientId, doctorId, sessionId (opcional)
- title, duration, audioUrl (Supabase Storage)
- transcript (opcional)

### SessionNote
- Contenido markdown
- isPrivate (solo médico lo ve)

### Task
- title, description, dueDate
- status: PENDING, IN_PROGRESS, COMPLETED, CANCELLED
- priority: LOW, MEDIUM, HIGH, URGENT

## Tech Stack

- **DB**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage (audio files)
- **Frontend**: Next.js 15 existente

## Schema Prisma

Archivo: `prisma/schema.prisma`

Modelos principales:
- Admin
- Insurance
- Doctor
- InsuranceDoctor (relación N:N)
- Patient
- PatientAssignment
- PatientMetric
- Session
- Exercise
- RepData
- FingerStatus
- AudioRecording
- SessionNote
- Task
- Alert

## Task Plan - Fase 1

### A: Infraestructura
- A1: Configurar Prisma
- A2: Configurar Supabase
- A3: Variables de entorno
- A4: Migración

### B: Auth y Admin
- B1: Supabase Auth
- B2: Seed Admin
- B3: API Mutuas

### C: Mutua y Doctor
- C1: API Médicos
- C2: API Pacientes
- C3: Asignaciones

### D: Core Médico
- D1: Notas
- D2: Tareas
- D3: Audio

### E: Prototipo
- E1: Seed Ejercicios
- E2: API Sesiones
- E3: Métricas
- E4: Alertas

## Estado de Implementación

### A1 ✅ COMPLETADO: Configurar Prisma
- Instalar dependencias: `npm install prisma @prisma/client dotenv --save-dev`
- Inicializar: `npx prisma init`
- Schema creado: `prisma/schema.prisma` con 16 modelos
- Cliente generado: `src/lib/prisma.ts`
- Pendiente: Migración a Supabase (Error de conexión)

### A2 ✅ COMPLETADO: Configurar Supabase
- Proyecto: `qkvujadxflslsfkezxpo.supabase.co`
- Proveedor: PostgreSQL en Supabase
- Pending: Verificar credenciales de conexión

### A3 ✅ COMPLETADO: Variables de entorno
- `.env` configurado con DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY

### A4 ✅ COMPLETADO: Migración
- Migración aplicada: `20260307121535_init`
- Tablas creadas en Supabase
- Conexión via Session Pooler (5432)

## Notas Importantes

1. La "Sesión de Audio" es DEL MÉDICO, no del paciente
2. El paciente usa la app móvil (prototipo existente) para ejercicios visuales
3. Supabase para: PostgreSQL + Auth + Storage (audios)
