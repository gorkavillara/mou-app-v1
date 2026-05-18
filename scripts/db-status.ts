import { config } from 'dotenv';
import { Client } from 'pg';

config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const c = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const tables = await c.query<{ table_name: string; row_count: number }>(`
    select c.relname as table_name, c.reltuples::bigint as row_count
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname;
  `);

  console.log(`Public tables: ${tables.rows.length}`);
  for (const r of tables.rows) console.log(`  - ${r.table_name} (~${r.row_count} rows)`);

  const authUsers = await c.query<{ count: string }>('select count(*) from auth.users');
  console.log(`\nAuth users: ${authUsers.rows[0].count}`);

  const migrations = await c.query<{ version: string; name: string }>(
    `select version, name from supabase_migrations.schema_migrations order by version`,
  ).catch(() => ({ rows: [] }));
  console.log(`\nApplied migrations: ${migrations.rows.length}`);
  for (const r of migrations.rows) console.log(`  - ${r.version} ${r.name ?? ''}`);

  await c.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
