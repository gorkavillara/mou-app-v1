/**
 * One-shot: create a doctor in Supabase Auth + insert the matching row in
 * public.doctors. Idempotent on re-run with the same email (skips if exists).
 *
 * Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to talk to the Auth admin API
 * (bypasses RLS).
 *
 * Usage:
 *   npx tsx scripts/create-doctor.ts --email <e> --password <p> --label '<text>'
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const email = arg('email');
const password = arg('password');
const label = arg('label') ?? 'Doctor';

if (!email || !password) {
  console.error('Usage: tsx scripts/create-doctor.ts --email <e> --password <p> [--label "Dr. X"]');
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1. Find existing user with that email (admin.listUsers paginates).
  let userId: string | null = null;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email!.toLowerCase());
    if (found) { userId = found.id; break; }
    if (data.users.length < 1000) break;
  }

  if (userId) {
    console.log(`Auth user already exists: ${userId}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user!.id;
    console.log(`Auth user created: ${userId}`);
  }

  // 2. Upsert doctor row.
  const { error: docError } = await supabase
    .from('doctors')
    .upsert({ id: userId, external_label: label }, { onConflict: 'id' });
  if (docError) throw docError;

  console.log(`Doctor row ready: ${userId} (${label})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
