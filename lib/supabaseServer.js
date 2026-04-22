import 'server-only';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dev-anon-key';

/**
 * Creates a stateless Supabase client for server-side auth checks.
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createSupabaseServerClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Resolves the required service role key for privileged operations.
 *
 * @returns {string}
 * @throws {Error} If SUPABASE_SERVICE_ROLE_KEY is not set at runtime.
 */
function getServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('[SUP-502] SUPABASE_SERVICE_ROLE_KEY is required for privileged server operations.');
  }

  return key;
}

export const supabaseServer = createSupabaseServerClient();

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let _supabaseAdmin = null;

/**
 * Lazily-initialized Supabase admin client for privileged operations.
 * Defers creation to runtime to avoid build-time errors in serverless environments.
 *
 * @type {import('@supabase/supabase-js').SupabaseClient}
 */
export const supabaseAdmin = new Proxy(/** @type {any} */({}), {
  get(_target, prop) {
    if (!_supabaseAdmin) {
      _supabaseAdmin = createClient(
        supabaseUrl,
        getServiceRoleKey(),
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );
    }
    return Reflect.get(_supabaseAdmin, prop);
  },
});
