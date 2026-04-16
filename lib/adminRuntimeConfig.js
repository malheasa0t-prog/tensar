/**
 * Resolves the legacy admin runtime configuration from environment variables.
 */

const SUPABASE_URL_ENV_KEY = 'NEXT_PUBLIC_SUPABASE_URL';
const SUPABASE_PUBLIC_KEY_ENV_KEYS = Object.freeze([
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]);

/**
 * Reads and trims a single environment variable.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @param {string} key
 * @returns {string}
 */
function readEnvValue(env = process.env, key) {
  return String(env?.[key] || '').trim();
}

/**
 * Lists the public environment keys still required by the legacy admin shell.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {string[]}
 */
export function getMissingAdminRuntimeConfigKeys(env = process.env) {
  const missingKeys = [];
  const supabaseUrl = readEnvValue(env, SUPABASE_URL_ENV_KEY);
  const hasPublicKey = SUPABASE_PUBLIC_KEY_ENV_KEYS.some((key) => readEnvValue(env, key));

  if (!supabaseUrl) {
    missingKeys.push(SUPABASE_URL_ENV_KEY);
  }

  if (!hasPublicKey) {
    missingKeys.push(...SUPABASE_PUBLIC_KEY_ENV_KEYS);
  }

  return missingKeys;
}

/**
 * Builds a safe diagnostics message for missing admin runtime config values.
 *
 * @param {string[]} missingKeys
 * @returns {string}
 */
function buildMissingConfigMessage(missingKeys) {
  return `Legacy admin runtime config is incomplete. Missing: ${missingKeys.join(', ')}`;
}

/**
 * Resolves the legacy admin runtime configuration from environment variables.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {{
 *   supabaseUrl: string,
 *   supabasePublishableKey: string,
 *   writeEnabled: boolean,
 * }}
 * @throws {Error}
 */
export function getAdminRuntimeConfig(env = process.env) {
  const missingKeys = getMissingAdminRuntimeConfigKeys(env);
  const supabaseUrl = readEnvValue(env, SUPABASE_URL_ENV_KEY);
  const supabasePublishableKey = SUPABASE_PUBLIC_KEY_ENV_KEYS
    .map((key) => readEnvValue(env, key))
    .find(Boolean) || '';

  if (missingKeys.length > 0) {
    throw new Error(buildMissingConfigMessage(missingKeys));
  }

  return {
    supabaseUrl,
    supabasePublishableKey,
    writeEnabled: readEnvValue(env, 'ENABLE_LEGACY_ADMIN_WRITE') === 'true',
  };
}
