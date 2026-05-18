/**
 * One-shot: drop every legacy table in public.* before applying the Fase 1
 * migration. Preserves the auth.* schema (auth.users, auth.sessions, …).
 *
 * Idempotent — re-running it on a clean schema is a no-op.
 *
 * Usage:
 *   npx tsx scripts/reset-public-schema.ts --confirm
 */

import { config } from 'dotenv';
import { Client } from 'pg';

config();

if (!process.argv.includes('--confirm')) {
  console.error('Refusing to run without --confirm. This drops every public.* table.');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const c = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const { rows: tables } = await c.query<{ table_name: string }>(
    `select tablename as table_name
     from pg_tables
     where schemaname = 'public'
     order by tablename`,
  );

  if (tables.length === 0) {
    console.log('public schema already empty.');
    await c.end();
    return;
  }

  console.log(`Dropping ${tables.length} tables from public.*:`);
  for (const t of tables) console.log(`  - ${t.table_name}`);

  // Drop all in one transaction with cascade so FKs and RLS policies go too.
  await c.query('begin');
  try {
    for (const t of tables) {
      await c.query(`drop table if exists public."${t.table_name}" cascade`);
    }
    // Drop any leftover views (e.g. patient_adherence from a previous attempt).
    const { rows: views } = await c.query<{ viewname: string }>(
      `select viewname from pg_views where schemaname = 'public'`,
    );
    for (const v of views) {
      await c.query(`drop view if exists public."${v.viewname}" cascade`);
    }
    // Drop any leftover sequences not owned by surviving tables.
    const { rows: seqs } = await c.query<{ sequence_name: string }>(
      `select sequence_name from information_schema.sequences where sequence_schema = 'public'`,
    );
    for (const s of seqs) {
      await c.query(`drop sequence if exists public."${s.sequence_name}" cascade`);
    }
    // Reset migration ledger so apply-migrations re-runs Fase 1 from scratch.
    await c.query('drop schema if exists supabase_migrations cascade');
    await c.query('commit');
  } catch (err) {
    await c.query('rollback');
    throw err;
  }

  console.log('\nDone. public schema is empty.');
  await c.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
