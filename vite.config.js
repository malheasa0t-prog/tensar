/**
 * Vite Configuration for TechZone SPA.
 *
 * Includes Next.js compatibility shims via resolve aliases,
 * environment variable mapping, and build settings.
 *
 * Uses oxc.include to ensure .js files containing JSX are
 * correctly parsed by the OXC transformer in Vite 8.
 */

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { buildAdminRuntimeAssetSource, resolveAdminRuntimeAssetConfig } from './lib/adminRuntimeAsset.js';
import {
  createClientBundleLeakGuardPlugin,
  resolveClientSecurityManualChunk,
} from './lib/clientBundleSecurity.js';
import { resolvePublicBuildEnv } from './lib/requiredPublicEnv.js';

/**
 * Serves and emits the legacy admin runtime config asset from environment values.
 *
 * @param {string} assetSource
 * @returns {import('vite').Plugin}
 */
function createLegacyAdminRuntimeAssetPlugin(assetSource) {
  const responseBody = String(assetSource || '');

  return {
    name: 'legacy-admin-runtime-asset',
    configureServer(server) {
      server.middlewares.use('/admin-config.js', (_request, response) => {
        response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        response.end(responseBody);
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'admin-config.js',
        source: responseBody,
      });
    },
  };
}

/**
 * Builds production minifier options that remove browser diagnostics.
 *
 * @param {string} command
 * @returns {import('rolldown').OutputOptions['minify'] | undefined}
 */
function resolveOutputMinifyOptions(command) {
  if (command !== 'build') {
    return undefined;
  }

  return {
    compress: {
      dropConsole: true,
      dropDebugger: true,
    },
    mangle: true,
    codegen: {
      removeWhitespace: true,
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const { siteUrl, supabaseUrl, supabaseAnonKey } = resolvePublicBuildEnv(env, command);
  const adminRuntimeAssetSource = buildAdminRuntimeAssetSource(
    resolveAdminRuntimeAssetConfig(env, command)
  );

  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    server: {
      port: 3000,
      strictPort: true,
    },
    plugins: [
      react({
        include: /\.(js|jsx|ts|tsx)$/,
      }),
      createClientBundleLeakGuardPlugin(),
      createLegacyAdminRuntimeAssetPlugin(adminRuntimeAssetSource),
    ],
    oxc: {
      include: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
      jsx: {
        runtime: 'automatic',
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
        'next/link': path.resolve(__dirname, 'src/shims/next-link.jsx'),
        'next/navigation': path.resolve(__dirname, 'src/shims/next-navigation.js'),
        'next/image': path.resolve(__dirname, 'src/shims/next-image.jsx'),
        'next/dynamic': path.resolve(__dirname, 'src/shims/next-dynamic.js'),
        'next/script': path.resolve(__dirname, 'src/shims/next-script.jsx'),
        'next/font/google': path.resolve(__dirname, 'src/shims/next-font.js'),
        'next/og': path.resolve(__dirname, 'src/shims/next-font.js'),
      },
    },
    define: {
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'process.env.NEXT_PUBLIC_SITE_URL': JSON.stringify(siteUrl),
      'process.env.NEXT_PUBLIC_AUTH_SOCIAL_PROVIDERS': JSON.stringify(
        env.NEXT_PUBLIC_AUTH_SOCIAL_PROVIDERS || ''
      ),
      'process.env.npm_package_version': JSON.stringify(env.npm_package_version || '1.0.0'),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          minify: resolveOutputMinifyOptions(command),
          manualChunks(id) {
            return resolveClientSecurityManualChunk(id);
          },
        },
      },
    },
  };
});
