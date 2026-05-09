import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client — BYPASSES RLS.
 *
 * Used exclusively by the patient-facing API routes (`/api/patient/[token]/*`)
 * which authenticate via an opaque `access_token`, not via Supabase Auth.
 *
 * IMPORTANT:
 *   - NEVER import this from a Client Component or any module that ships to
 *     the browser. The service-role key has full DB privileges.
 *   - Cached at module scope so we don't pay the constructor cost per request.
 *   - `autoRefreshToken: false` and `persistSession: false` because there is no
 *     user session to manage on the server.
 */
let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase admin client missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  _admin = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _admin;
}
