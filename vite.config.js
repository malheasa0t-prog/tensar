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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || 'dev-anon-key';

  return {
    plugins: [
      react({
        include: /\.(js|jsx|ts|tsx)$/,
      }),
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
        'server-only': path.resolve(__dirname, 'src/shims/server-only.js'),
      },
    },
    define: {
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'process.env.npm_package_version': JSON.stringify(env.npm_package_version || '1.0.0'),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
