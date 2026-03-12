import { createBrowserClient, createServerClient, isBrowser, parse, serialize } from '@supabase/ssr';
import type { Database } from './database.types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function createServerClientFromCookies(cookies: {
  get: (name: string) => string | undefined;
  set: (name: string, value: string, options?: Record<string, unknown>) => void;
  delete: (name: string, options?: Record<string, unknown>) => void;
}) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookies.get(name);
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          cookies.set(name, value, options);
        },
        remove(name: string, options: Record<string, unknown>) {
          cookies.delete(name, options);
        },
      },
    }
  );
}
