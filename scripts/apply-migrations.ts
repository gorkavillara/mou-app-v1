/**
 * Apply pending Supabase migrations against DATABASE_URL.
 *
 * Reads .env, finds every .sql file under supabase/migrations/, and applies
 * the ones not already present in supabase_migrations.schema_migrations.
 *
 * Usage:
 *   npx tsx scripts/apply-migrations.ts          # apply pending
 *   npx tsx scripts/apply-migrations.ts --status # show what would be applied
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { config } from 'dotenv';
import { Client } from 'pg';

config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not set in .env');
  process.exit(1);
}

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
const statusOnly = process.argv.includes('--status');

type Migration = { version: string; name: string; path: string; sql: string };

function loadMigrations(): Migration[] {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return files.map((file) => {
    const path = join(migrationsDir, file);
    const sql = readFileSync(path, 'utf8');
    const match = file.match(/^(\d+)_(.+)\.sql$/);
    if (!match) throw new Error(`Bad migration filename: ${file}`);
    return { version: match[1], name: match[2], path, sql };
  });
}

async function main() {
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  await client.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      name text,
      statements text[],
      applied_at timestamptz not null default now()
    );
  `);

  const { rows: applied } = await client.query<{ version: string }>(
    'select version from supabase_migrations.schema_migrations',
  );
  const appliedSet = new Set(applied.map((r) => r.version));
  const migrations = loadMigrations();

  const pending = migrations.filter((m) => !appliedSet.has(m.version));

  console.log(`Local migrations:  ${migrations.length}`);
  console.log(`Already applied:   ${applied.length}`);
  console.log(`Pending:           ${pending.length}`);
  for (const m of pending) console.log(`  - ${m.version}_${m.name}`);

  if (statusOnly || pending.length === 0) {
    await client.end();
    return;
  }

  for (const m of pending) {
    console.log(`\nApplying ${m.version}_${m.name}...`);
    try {
      await client.query('begin');
      await client.query(m.sql);
      await client.query(
        'insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)',
        [m.version, m.name],
      );
      await client.query('commit');
      console.log(`  ✓ ${basename(m.path)}`);
    } catch (err) {
      await client.query('rollback');
      console.error(`  ✗ ${basename(m.path)} failed:`, err);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
