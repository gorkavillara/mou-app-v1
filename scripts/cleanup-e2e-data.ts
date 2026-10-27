/**
 * Cleanup helper: deletes accumulated patients/sessions/prescriptions/
 * rep_measurements created by past Playwright runs against the E2E doctor,
 * plus the audit_log rows their triggers left behind. Only rows of the E2E
 * doctor are touched (see cleanup-e2e-statements.ts).
 *
 * Idempotent. Run this when the test DB is bloated and goto times out on the
 * /doctor list because there are 100+ patients.
 *
 * Usage:
 *   npx tsx scripts/cleanup-e2e-data.ts --confirm
 */

import { config } from 'dotenv';
import { Client } from 'pg';
import { E2E_CLEANUP_STATEMENTS } from './cleanup-e2e-statements';

config();

if (!process.argv.includes('--confirm')) {
  console.error('Refusing to run without --confirm.');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
const e2eEmail = (process.env.MOU_E2E_EMAIL ?? 'e2e@mou.local').toLowerCase();
if (!databaseUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const c = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const { rows: doctors } = await c.query<{ id: string }>(
    `select d.id from public.doctors d
     join auth.users u on u.id = d.id
     where lower(u.email) = $1`,
    [e2eEmail],
  );
  if (doctors.length === 0) {
    console.log('No e2e doctor found, nothing to clean.');
    await c.end();
    return;
  }
  const doctorId = doctors[0].id;

  const { rows: counts } = await c.query<{ patient_count: string }>(
    `select count(*) as patient_count from public.patients where doctor_id = $1`,
    [doctorId],
  );
  console.log(`E2E doctor ${doctorId} owns ${counts[0].patient_count} patients. Deleting…`);

  await c.query('begin');
  try {
    for (const { table, sql } of E2E_CLEANUP_STATEMENTS) {
      const { rowCount } = await c.query(sql, [doctorId]);
      console.log(`  ${table}: ${rowCount ?? 0} rows deleted`);
    }
    await c.query('commit');
  } catch (err) {
    await c.query('rollback');
    throw err;
  }

  console.log('Done.');
  await c.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
