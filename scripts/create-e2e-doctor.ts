/**
 * Idempotent: ensure an end-to-end test doctor exists in Supabase Auth +
 * public.doctors. Used exclusively by the Playwright suite.
 *
 * Reads MOU_E2E_EMAIL and MOU_E2E_PASSWORD from .env, falling back to
 * sane defaults. The password should be set in .env so it is not in git.
 *
 * Usage:
 *   npx tsx scripts/create-e2e-doctor.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const email = process.env.MOU_E2E_EMAIL ?? 'e2e@mou.local';
const password = process.env.MOU_E2E_PASSWORD ?? 'mou-e2e-CHANGE-ME!';

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
  // 1. Find or create the auth user.
  let userId: string | null = null;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      userId = found.id;
      // Refresh the password so the test suite can always log in.
      await supabase.auth.admin.updateUserById(userId, { password });
      break;
    }
    if (data.users.length < 1000) break;
  }

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user!.id;
  }

  // 2. Upsert the doctors row with a stable label.
  const { error: docError } = await supabase
    .from('doctors')
    .upsert({ id: userId, external_label: 'Dr. E2E' }, { onConflict: 'id' });
  if (docError) throw docError;

  console.log(`E2E doctor ready: ${userId} (${email})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
