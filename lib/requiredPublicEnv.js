/**
 * Public environment variable helpers for Vite-based builds.
 */

const REQUIRED_PUBLIC_ENV_KEYS = Object.freeze([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]);

/**
 * Reads and trims an environment variable.
 *
 * @param {Record<string, string | undefined> | undefined} env
 * @param {string} key
 * @returns {string}
 */
export function readEnvValue(env, key) {
  return String(env?.[key] ?? '').trim();
}

/**
 * Lists missing public environment variables required for browser builds.
 *
 * @param {Record<string, string | undefined> | undefined} env
 * @returns {string[]}
 */
export function getMissingPublicBuildEnvKeys(env) {
  return REQUIRED_PUBLIC_ENV_KEYS.filter((key) => !readEnvValue(env, key));
}

/**
 * Resolves the public environment variables used by the Vite bundle.
 *
 * Throws only during production builds so local tooling can inspect config
 * without requiring credentials in every shell session.
 *
 * @param {Record<string, string | undefined> | undefined} env
 * @param {string} command
 * @returns {{ supabaseAnonKey: string, supabaseUrl: string }}
 * @throws {Error}
 */
export function resolvePublicBuildEnv(env, command) {
  const supabaseUrl = readEnvValue(env, 'NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = readEnvValue(env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const missingKeys = getMissingPublicBuildEnvKeys(env);

  if (command === 'build' && missingKeys.length > 0) {
    throw new Error(
      `[ENV-101] Missing required public environment variables for Vite build: ${missingKeys.join(', ')}`
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}
