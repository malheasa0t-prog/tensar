/**
 * Tests for Supabase auth redirect URL helpers.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuthCallbackRedirectUrl,
  buildAuthRedirectUrl,
  buildPasswordRecoveryRedirectUrl,
  resolveAuthRedirectOrigin,
} from "./authRedirectUrl.js";

test("resolveAuthRedirectOrigin should prefer the configured site URL", () => {
  assert.equal(
    resolveAuthRedirectOrigin({
      configuredSiteUrl: "https://tensr.systems",
      browserOrigin: "http://localhost:3000",
    }),
    "https://tensr.systems"
  );
});

test("resolveAuthRedirectOrigin should normalize bare domains", () => {
  assert.equal(
    resolveAuthRedirectOrigin({ configuredSiteUrl: "tensr.systems/" }),
    "https://tensr.systems"
  );
});

test("resolveAuthRedirectOrigin should fall back to the browser origin", () => {
  assert.equal(
    resolveAuthRedirectOrigin({
      configuredSiteUrl: "",
      browserOrigin: "http://localhost:3000",
    }),
    "http://localhost:3000"
  );
});

test("buildAuthRedirectUrl should build an absolute site-owned path", () => {
  assert.equal(
    buildAuthRedirectUrl({
      configuredSiteUrl: "https://tensr.systems",
      path: "auth/custom",
    }),
    "https://tensr.systems/auth/custom"
  );
});

test("buildAuthCallbackRedirectUrl should target the callback route", () => {
  assert.equal(
    buildAuthCallbackRedirectUrl({ configuredSiteUrl: "https://tensr.systems" }),
    "https://tensr.systems/auth/callback/"
  );
});

test("buildPasswordRecoveryRedirectUrl should target the recovery route", () => {
  assert.equal(
    buildPasswordRecoveryRedirectUrl({ configuredSiteUrl: "https://tensr.systems" }),
    "https://tensr.systems/auth/recover"
  );
});
