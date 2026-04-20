/**
 * Lazily loads the shared browser Supabase client.
 */

let pendingSupabaseClientPromise = null;

/**
 * Returns the shared Supabase browser client on demand.
 *
 * @returns {Promise<Record<string, unknown>>}
 */
export async function loadSupabaseClient() {
  if (!pendingSupabaseClientPromise) {
    pendingSupabaseClientPromise = import("./supabaseClient.js").then(
      (module) => module.supabase
    );
  }

  return pendingSupabaseClientPromise;
}
