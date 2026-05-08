# Supabase — Mou Fase 1

Migraciones de base de datos para Supabase. Source of truth del schema: ver
[`docs/obsidian-vault/06-Modelo-datos.md`](../docs/obsidian-vault/06-Modelo-datos.md).

## Aplicar la migración

### Opción A — Supabase Dashboard
1. Abrir el SQL Editor del proyecto.
2. Pegar el contenido de `migrations/20260508000000_fase1_init.sql`.
3. Run.

### Opción B — CLI (recomendado para desarrollo)
```bash
# Instalar la CLI si no está
npm i -g supabase

# Vincular al proyecto remoto (una sola vez)
supabase login
supabase link --project-ref <ref-del-proyecto>

# Aplicar migraciones
supabase db push
```

## Crear el doctor inicial (Miguel)

Tras aplicar la migración, crear manualmente al doctor desde el dashboard:

1. *Authentication → Users → Add user*. Email + password.
2. Insertar la fila en `doctors`:
   ```sql
   insert into public.doctors (id, external_label)
   values ('<uuid-del-user-recién-creado>', 'Dr. Miguel');
   ```

## Verificar el seed
```sql
select code, name, target_finger from public.exercises;
-- Debe devolver:
--  flexion-pasiva-dedos    | Flexión pasiva de dedos    | all
--  extension-activa-dedos  | Extensión activa de dedos  | all
```
