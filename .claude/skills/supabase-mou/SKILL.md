---
name: supabase-mou
description: Acceso a la base de datos Supabase del proyecto Mou (qkvujadxflslsfkezxpo) vía el MCP oficial. Aplica migraciones, consulta el schema Fase 1, ejecuta SQL contra Postgres, gestiona usuarios de Auth, regenera tipos TypeScript y revisa logs. Trigger cuando el usuario quiere aplicar/inspeccionar la BD del proyecto Mou, dar de alta al doctor en Auth, debuggear datos en producción/dev, o regenerar database.types.ts.
---

# Supabase — Mou

Skill específica del proyecto para operar contra el Supabase de Mou (panel del doctor + piloto 20 pacientes).

## Contexto

- **Proyecto**: Mou (rehabilitación de mano)
- **Project ref**: `qkvujadxflslsfkezxpo`
- **Project URL**: `https://qkvujadxflslsfkezxpo.supabase.co`
- **Región**: eu-west-1 (AWS)
- **Schema autoritativo**: [docs/obsidian-vault/06-Modelo-datos.md](../../../docs/obsidian-vault/06-Modelo-datos.md)
- **Migraciones**: [supabase/migrations/](../../../supabase/migrations/)

## Configuración del MCP

El MCP server está declarado en `.mcp.json` (project root) usando `@supabase/mcp-server-supabase` scopeado al proyecto. Requiere `SUPABASE_ACCESS_TOKEN` (PAT) en `.env`.

**Crear PAT**: https://supabase.com/dashboard/account/tokens

**Verificar que el MCP carga**:
```bash
claude mcp list | Select-String supabase
```

Si aparece como "Failed to connect", revisar que `SUPABASE_ACCESS_TOKEN` está poblado en `.env` y que la sesión de Claude se ha reiniciado tras el cambio.

## Tablas Fase 1

| Tabla | Qué guarda |
|---|---|
| `doctors` | 1 fila (Javi). id = auth.users.id. |
| `exercises` | Catálogo global (2 ejercicios seedeados). |
| `patients` | Pacientes anónimos (external_id, sin PII). |
| `prescriptions` | Pauta por paciente (sets×reps×frecuencia×duración). |
| `sessions` | Una por sesión completada. |
| `rep_measurements` | Una fila por (rep × articulación). |

Vista derivada: `patient_adherence` (adherencia % calculada on-demand).

## Operaciones frecuentes

### Aplicar una migración nueva
```
mcp__supabase__apply_migration(name="<descripción_corta>", query="<SQL>")
```
Las migraciones quedan registradas en `supabase_migrations.schema_migrations`. Mantener un fichero gemelo en `supabase/migrations/<timestamp>_<name>.sql` para que estén también en git.

### Inspeccionar el schema actual
```
mcp__supabase__list_tables(schemas=["public"])
mcp__supabase__list_migrations()
```

### Ejecutar SQL de lectura
```
mcp__supabase__execute_sql(query="select * from public.patients limit 5")
```

### Crear el doctor inicial (Javi)

1. Crear el usuario en Auth desde el dashboard (Authentication → Users → Add user) o vía MCP.
2. Insertar la fila en `doctors`:
   ```sql
   insert into public.doctors (id, external_label)
   values ('<uuid-del-user>', 'Dr. Javi');
   ```

### Regenerar tipos TypeScript
```
mcp__supabase__generate_typescript_types()
```
Sobreescribir [src/lib/database.types.ts](../../../src/lib/database.types.ts) con el resultado tras añadir tablas o cambiar columnas. Mantener los tipos auxiliares (`PathologyCode`, `TargetFinger`, etc.) que ahora están a mano.

### Revisar logs
```
mcp__supabase__get_logs(service="postgres" | "api" | "auth")
```

## Convenciones específicas de Mou

- **No PII en `patients`**: `name`, `email`, `phone`, `dob` están prohibidas explícitamente. Si surge la necesidad, primero actualizar [docs/obsidian-vault/02-Decisiones-clave.md](../../../docs/obsidian-vault/02-Decisiones-clave.md) (D3) y luego migrar.
- **RLS por doctor**: todas las tablas de paciente filtran por `doctor_id = auth.uid()`. El acceso del paciente vía URL bypassa RLS usando `service_role` desde el endpoint Next.js — nunca exponer el `service_role` al cliente.
- **Migraciones inmutables**: una vez aplicada y fuera de la rama de desarrollo, no editar la SQL — añadir una migración nueva.

## Queries útiles para debugging del piloto

```sql
-- Pacientes activos por doctor con su adherencia
select p.external_id, p.started_at, pa.adherence_pct, pa.completed_sessions, pa.expected_sessions
from public.patients p
left join public.patient_adherence pa on pa.patient_id = p.id
where p.doctor_id = auth.uid()
  and p.discharged_at is null
order by p.started_at desc;

-- Últimas sesiones de un paciente
select s.started_at, s.reps_completed, s.target_reps, s.completion_pct,
       e.code as exercise
from public.sessions s
join public.prescriptions pr on pr.id = s.prescription_id
join public.exercises e on e.id = pr.exercise_id
where s.patient_id = '<uuid>'
order by s.started_at desc
limit 20;

-- Distribución de ángulos máximos por articulación de un paciente
select rm.joint, avg(rm.max_flexion_deg) as avg_flex, max(rm.max_flexion_deg) as peak_flex, count(*) as samples
from public.rep_measurements rm
join public.sessions s on s.id = rm.session_id
where s.patient_id = '<uuid>'
group by rm.joint
order by rm.joint;

-- RLS policies actuales (verificar después de migrar)
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

## Seguridad

- El PAT en `.env` da privilegios de owner sobre el proyecto. **No commitear `.env`** (ya en `.gitignore`).
- En `.mcp.json` la variable se resuelve con `${SUPABASE_ACCESS_TOKEN}` — el JSON sí se commitea.
- Para inspección de solo lectura, configurar `--read-only` en los args del MCP server.
