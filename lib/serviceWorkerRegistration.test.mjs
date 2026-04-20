import assert from "node:assert/strict";
import test from "node:test";
import { canRegisterServiceWorker } from "./serviceWorkerRegistration.js";

test("canRegisterServiceWorker should require service worker support", () => {
  assert.equal(
    canRegisterServiceWorker({
      navigator: {},
      window: { isSecureContext: true, location: { hostname: "tensar.pages.dev" } },
    }),
    false
  );
});

test("canRegisterServiceWorker should allow secure production origins", () => {
  assert.equal(
    canRegisterServiceWorker({
      navigator: { serviceWorker: {} },
      window: { isSecureContext: true, location: { hostname: "tensar.pages.dev" } },
    }),
    true
  );
});

test("canRegisterServiceWorker should allow localhost during development", () => {
  assert.equal(
    canRegisterServiceWorker({
      navigator: { serviceWorker: {} },
      window: { isSecureContext: false, location: { hostname: "localhost" } },
    }),
    true
  );
});
