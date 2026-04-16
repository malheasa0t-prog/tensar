import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const repoRoot = path.resolve(currentDir, "..");
const appRoot = path.resolve(repoRoot, "app");
const APP_JSX_PROXY_SUFFIX = ".vite.jsx";

/**
 * Rewrites JavaScript files inside the app directory to virtual `.jsx` ids so Vite can parse JSX.
 *
 * @returns {import("vite").Plugin}
 */
function appJsxProxyPlugin() {
  return {
    name: "tensar-app-jsx-proxy",
    enforce: "pre",
    async resolveId(source, importer, options) {
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true
      });

      if (!resolved || resolved.external) {
        return resolved;
      }

      if (resolved.id.startsWith(appRoot) && resolved.id.endsWith(".js")) {
        return `${resolved.id}${APP_JSX_PROXY_SUFFIX}`;
      }

      return resolved;
    },
    async load(id) {
      if (!id.endsWith(APP_JSX_PROXY_SUFFIX)) {
        return null;
      }

      const originalId = id.slice(0, -APP_JSX_PROXY_SUFFIX.length);
      const source = await readFile(originalId, "utf8");
      const transformed = await transformWithEsbuild(source, originalId, {
        loader: "jsx",
        jsx: "automatic"
      });

      return transformed;
    }
  };
}

/**
 * Allows Vite to compile the existing project files that still use JSX inside `.js` files.
 *
 * @returns {import("vite").Plugin}
 */
function jsxInJsFilesPlugin() {
  const sourceRoots = ["app", "components", "hooks", "lib", "services", "non-next-site/src"].map(
    (segment) => path.resolve(repoRoot, segment)
  );

  return {
    name: "tensar-jsx-in-js",
    enforce: "pre",
    async transform(code, id) {
      const isJavaScriptFile = id.endsWith(".js");
      const isProjectSource = sourceRoots.some((sourceRoot) => id.startsWith(sourceRoot));

      if (!isJavaScriptFile || !isProjectSource) {
        return null;
      }

      return transformWithEsbuild(code, id, {
        loader: "jsx",
        jsx: "automatic"
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, currentDir, "");

  return {
    plugins: [appJsxProxyPlugin(), jsxInJsFilesPlugin(), react()],
    publicDir: path.resolve(repoRoot, "public"),
    resolve: {
      alias: [
        { find: "@", replacement: repoRoot },
        {
          find: "next/link",
          replacement: path.resolve(currentDir, "src/compat/next-link.jsx")
        },
        {
          find: "next/image",
          replacement: path.resolve(currentDir, "src/compat/next-image.jsx")
        },
        {
          find: "next/navigation",
          replacement: path.resolve(currentDir, "src/compat/next-navigation.js")
        },
        {
          find: "next/script",
          replacement: path.resolve(currentDir, "src/compat/next-script.jsx")
        },
        {
          find: "next/dynamic",
          replacement: path.resolve(currentDir, "src/compat/next-dynamic.jsx")
        }
      ]
    },
    server: {
      fs: {
        allow: [repoRoot]
      },
      proxy: {
        "/api": {
          target: env.VITE_BACKEND_ORIGIN || "https://tensr.systems",
          changeOrigin: true,
          secure: true
        }
      }
    },
    define: {
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || ""
      ),
      "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ""
      ),
      "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || ""
      ),
      "process.env.NEXT_PUBLIC_SITE_URL": JSON.stringify(
        env.NEXT_PUBLIC_SITE_URL || env.VITE_SITE_URL || "http://localhost:5173"
      ),
      "process.env.SITE_URL": JSON.stringify(
        env.SITE_URL || env.VITE_SITE_URL || "http://localhost:5173"
      ),
      "process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID": JSON.stringify(env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ""),
      "process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID": JSON.stringify(env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || ""),
      "process.env.NEXT_PUBLIC_HOTJAR_ID": JSON.stringify(env.NEXT_PUBLIC_HOTJAR_ID || ""),
      "process.env.NEXT_PUBLIC_HOTJAR_VERSION": JSON.stringify(env.NEXT_PUBLIC_HOTJAR_VERSION || ""),
      "process.env.NODE_ENV": JSON.stringify(mode)
    }
  };
});
