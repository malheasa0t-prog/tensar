import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./bootstrap.js", import.meta.url), "utf8");
const PUBLIC_SUPABASE_ERROR =
  "Legacy admin runtime config is incomplete. Missing: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY";

/**
 * Creates a minimal DOM surface for the legacy admin bootstrap flow.
 *
 * @returns {{
 *   context: vm.Context,
 *   controls: Array<{ disabled: boolean }>,
 *   description: { textContent: string },
 *   loginError: { style: { display: string }, textContent: string },
 *   loginOverlay: { attributes: Record<string, string>, style: { display: string } },
 *   title: { textContent: string }
 * }}
 */
function createBootstrapHarness() {
  const title = { textContent: "لوحة الإدارة" };
  const description = { textContent: "سجّل الدخول للوصول إلى لوحة التحكم الداخلية." };
  const loginError = { textContent: "", style: { display: "none" } };
  const controls = [{ disabled: false }, { disabled: false }, { disabled: false }];
  const loginForm = {
    style: { opacity: "1" },
    querySelectorAll(selector) {
      assert.equal(selector, "input, button");
      return controls;
    },
  };
  const loginOverlay = {
    attributes: {},
    style: { display: "none" },
    querySelector(selector) {
      if (selector === "h2") {
        return title;
      }

      if (selector === "p") {
        return description;
      }

      return null;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
  };
  const adminLayout = { style: { display: "grid" } };
  const elements = {
    adminLayout,
    adminLoginForm: loginForm,
    adminLoginOverlay: loginOverlay,
    loginError,
  };
  const document = {
    body: {
      appendChild() {
        throw new Error("appendChild should not run during bootstrap failure tests.");
      },
    },
    getElementById(id) {
      return elements[id] || null;
    },
  };
  const window = {
    __TZ_ADMIN_BOOTSTRAPPED: false,
    addEventListener() {},
    dispatchEvent() {},
    location: { href: "https://tensr.systems/admin" },
    setTimeout(callback) {
      callback();
      return 0;
    },
    supabase: {},
  };
  const context = vm.createContext({
    console: { error() {} },
    document,
    fetch: async () => ({
      json: async () => ({ error: PUBLIC_SUPABASE_ERROR }),
      ok: false,
      status: 500,
    }),
    navigator: {},
    window,
  });

  return { context, controls, description, loginError, loginOverlay, title };
}

/**
 * Waits for the async bootstrap IIFE to finish mutating the fake DOM.
 *
 * @returns {Promise<void>}
 */
async function flushBootstrapTasks() {
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.resolve();
}

test("bootstrap should reveal an actionable Arabic error when public Supabase keys are missing", async () => {
  const harness = createBootstrapHarness();

  vm.runInContext(SCRIPT_SOURCE, harness.context, {
    filename: "public/js/admin/bootstrap.js",
  });
  await flushBootstrapTasks();

  assert.equal(harness.loginOverlay.style.display, "flex");
  assert.equal(harness.loginOverlay.attributes["aria-hidden"], "false");
  assert.equal(harness.title.textContent, "تعذر تشغيل لوحة الإدارة");
  assert.equal(
    harness.description.textContent,
    "إعدادات تشغيل لوحة الإدارة غير مكتملة على بيئة الإنتاج حاليًا."
  );
  assert.match(harness.loginError.textContent, /مفاتيح Supabase العامة غير مضبوطة/);
  assert.equal(harness.loginError.style.display, "block");
  assert.equal(harness.controls.every((control) => control.disabled), true);
});

test("bootstrap should surface a generic runtime error instead of leaving the screen blank", async () => {
  const harness = createBootstrapHarness();
  harness.context.fetch = async () => ({
    json: async () => {
      throw new Error("Invalid JSON");
    },
    ok: false,
    status: 503,
  });

  vm.runInContext(SCRIPT_SOURCE, harness.context, {
    filename: "public/js/admin/bootstrap.js",
  });
  await flushBootstrapTasks();

  assert.equal(harness.loginOverlay.style.display, "flex");
  assert.equal(harness.loginError.textContent, "Failed to load admin runtime config (503).");
});
