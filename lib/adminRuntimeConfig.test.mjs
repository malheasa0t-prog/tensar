import test from 'node:test';
import assert from 'node:assert/strict';
import { getMissingAdminRuntimeConfigKeys } from './adminRuntimeConfig.js';

const ORIGINAL_ENV = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  enableLegacyAdminWrite: process.env.ENABLE_LEGACY_ADMIN_WRITE,
};

function restoreEnv() {
  if (ORIGINAL_ENV.supabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_ENV.supabaseUrl;

  if (ORIGINAL_ENV.supabaseAnonKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_ENV.supabaseAnonKey;

  if (ORIGINAL_ENV.supabasePublishableKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ORIGINAL_ENV.supabasePublishableKey;

  if (ORIGINAL_ENV.enableLegacyAdminWrite === undefined) delete process.env.ENABLE_LEGACY_ADMIN_WRITE;
  else process.env.ENABLE_LEGACY_ADMIN_WRITE = ORIGINAL_ENV.enableLegacyAdminWrite;
}

test('getAdminRuntimeConfig should return the publishable config and disabled writes by default', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.ENABLE_LEGACY_ADMIN_WRITE;

  const { getAdminRuntimeConfig } = await import(`./adminRuntimeConfig.js?case=default-${Date.now()}`);
  const result = getAdminRuntimeConfig();

  assert.deepEqual(result, {
    supabaseUrl: 'https://example.supabase.co',
    supabasePublishableKey: 'anon-key',
    writeEnabled: false,
  });

  restoreEnv();
});

test('getMissingAdminRuntimeConfigKeys should report both public key env names when no browser key is configured', () => {
  const missingKeys = getMissingAdminRuntimeConfigKeys({
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  });

  assert.deepEqual(missingKeys, [
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]);
});

test('getMissingAdminRuntimeConfigKeys should return an empty list when url and anon key are present', () => {
  const missingKeys = getMissingAdminRuntimeConfigKeys({
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  });

  assert.deepEqual(missingKeys, []);
});

test('getAdminRuntimeConfig should respect explicit publishable key and write toggle', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  process.env.ENABLE_LEGACY_ADMIN_WRITE = 'true';

  const { getAdminRuntimeConfig } = await import(`./adminRuntimeConfig.js?case=write-${Date.now()}`);
  const result = getAdminRuntimeConfig();

  assert.equal(result.supabasePublishableKey, 'publishable-key');
  assert.equal(result.writeEnabled, true);

  restoreEnv();
});

test('getAdminRuntimeConfig should throw when required config is missing', async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const { getAdminRuntimeConfig } = await import(`./adminRuntimeConfig.js?case=missing-${Date.now()}`);

  assert.throws(
    () => getAdminRuntimeConfig(),
    /Legacy admin runtime config is incomplete\. Missing: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY/
  );
  restoreEnv();
});
