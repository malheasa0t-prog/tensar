import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./session-guard.helpers.js", import.meta.url), "utf8");

function loadHooks() {
  const window = { __ENABLE_ADMIN_SESSION_GUARD_TEST_HOOKS__: true };
  const context = vm.createContext({ window });
  vm.runInContext(SCRIPT_SOURCE, context, { filename: "public/js/admin/session-guard.helpers.js" });
  return window.__adminSessionGuardTestHooks;
}

test("getSessionGuardState should enter warning window before timeout", () => {
  const hooks = loadHooks();
  const state = hooks.getSessionGuardState({
    now: 25 * 60 * 1000,
    lastActivityAt: 0,
    timeoutMs: 30 * 60 * 1000,
    warningWindowMs: 5 * 60 * 1000
  });

  assert.equal(state.isWarning, true);
  assert.equal(state.isExpired, false);
  assert.equal(state.remainingMs, 5 * 60 * 1000);
});

test("getSessionGuardState should report expiration when timeout elapses", () => {
  const hooks = loadHooks();
  const state = hooks.getSessionGuardState({
    now: 31 * 60 * 1000,
    lastActivityAt: 0,
    timeoutMs: 30 * 60 * 1000,
    warningWindowMs: 5 * 60 * 1000
  });

  assert.equal(state.isExpired, true);
  assert.equal(state.remainingMs, 0);
});
