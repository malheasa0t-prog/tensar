import 'server-only';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dev-anon-key';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
 * @throws {Error}
 */
function getServiceRoleKey() {
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for privileged server operations.');
  }

  return supabaseServiceRoleKey;
}

export const supabaseServer = createSupabaseServerClient();

export const supabaseAdmin = createClient(
  supabaseUrl,
  getServiceRoleKey(),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
