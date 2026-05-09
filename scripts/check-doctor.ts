import { config } from 'dotenv';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

config();

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const doctors = await c.query<{ id: string; external_label: string; created_at: string }>(
    'select id, external_label, created_at from public.doctors order by created_at',
  );
  console.log(`public.doctors: ${doctors.rows.length} fila(s)`);
  for (const d of doctors.rows) console.log(`  - ${d.id}  ${d.external_label}`);

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  console.log(`\nauth.users: ${data.users.length} fila(s)`);
  for (const u of data.users) console.log(`  - ${u.id}  ${u.email}`);

  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
