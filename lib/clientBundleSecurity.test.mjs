import test from "node:test";
import assert from "node:assert/strict";

import {
  CLIENT_SECURITY_LEAK_CHUNK,
  createClientBundleLeakGuardPlugin,
  findClientBundleSecurityLeaks,
  formatClientBundleSecurityLeakError,
  isForbiddenClientModuleId,
  normalizeClientModuleId,
  resolveClientSecurityManualChunk,
} from "./clientBundleSecurity.js";

test("normalizeClientModuleId should normalize slash direction and strip query strings", () => {
  assert.equal(
    normalizeClientModuleId("D:\\repo\\lib\\supabaseServer.js?v=1"),
    "D:/repo/lib/supabaseServer.js"
  );
});

test("isForbiddenClientModuleId should flag the server-only Supabase module", () => {
  assert.equal(isForbiddenClientModuleId("/workspace/lib/supabaseServer.js"), true);
  assert.equal(isForbiddenClientModuleId("/workspace/lib/supabaseClient.js"), false);
});

test("resolveClientSecurityManualChunk should isolate forbidden modules into a dedicated chunk", () => {
  assert.equal(
    resolveClientSecurityManualChunk("/workspace/lib/supabaseServer.js"),
    CLIENT_SECURITY_LEAK_CHUNK
  );
  assert.equal(resolveClientSecurityManualChunk("/workspace/src/App.jsx"), null);
});

test("findClientBundleSecurityLeaks should report forbidden modules and sensitive token references", () => {
  const leaks = findClientBundleSecurityLeaks({
    "assets/index.js": {
      type: "chunk",
      code: "const key = process.env.SUPABASE_SERVICE_ROLE_KEY;",
      modules: {
        "/workspace/lib/supabaseServer.js": {},
        "/workspace/src/App.jsx": {},
      },
    },
  });

  assert.deepEqual(leaks, [
    {
      fileName: "assets/index.js",
      category: "module",
      values: ["/workspace/lib/supabaseServer.js"],
    },
    {
      fileName: "assets/index.js",
      category: "token",
      values: ["SUPABASE_SERVICE_ROLE_KEY"],
    },
  ]);
});

test("formatClientBundleSecurityLeakError should build a readable error message", () => {
  const message = formatClientBundleSecurityLeakError([
    {
      fileName: "assets/index.js",
      category: "module",
      values: ["/workspace/lib/supabaseServer.js"],
    },
  ]);

  assert.match(message, /VCS-401/);
  assert.match(message, /assets\/index\.js/);
  assert.match(message, /supabaseServer\.js/);
});

test("createClientBundleLeakGuardPlugin should fail the build when a leak is detected", () => {
  const plugin = createClientBundleLeakGuardPlugin();
  const seenErrors = [];

  assert.throws(
    () =>
      plugin.generateBundle.call(
        {
          error(message) {
            seenErrors.push(message);
            throw new Error(message);
          },
        },
        {},
        {
          "assets/index.js": {
            type: "chunk",
            code: "const key = process.env.SUPABASE_SERVICE_ROLE_KEY;",
            modules: {
              "/workspace/lib/supabaseServer.js": {},
            },
          },
        }
      ),
    /VCS-401/
  );

  assert.equal(seenErrors.length, 1);
});
