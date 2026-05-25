/**
 * Tests for misplaced Supabase auth hash redirects.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCanonicalAuthForwardUrl,
  buildAuthHashForwardUrl,
  buildLocalhostAuthForwardUrl,
  isSupabaseAuthHash,
  redirectMisplacedAuthHash,
} from "./authHashRedirect.js";

test("isSupabaseAuthHash should detect access-token hashes", () => {
  assert.equal(isSupabaseAuthHash("#access_token=abc&type=signup"), true);
});

test("isSupabaseAuthHash should reject regular page anchors", () => {
  assert.equal(isSupabaseAuthHash("#features"), false);
});

test("buildAuthHashForwardUrl should move root auth hashes to the canonical callback", () => {
  assert.equal(
    buildAuthHashForwardUrl({
      configuredSiteUrl: "https://tensr.systems",
      href: "http://localhost:3000/#access_token=abc&type=signup",
    }),
    "https://tensr.systems/auth/callback/#access_token=abc&type=signup"
  );
});

test("buildLocalhostAuthForwardUrl should move local auth routes to the configured domain", () => {
  assert.equal(
    buildLocalhostAuthForwardUrl({
      configuredSiteUrl: "https://tensr.systems",
      href: "http://localhost:3000/auth/login?next=checkout",
    }),
    "https://tensr.systems/auth/login?next=checkout"
  );
});

test("buildLocalhostAuthForwardUrl should move an empty local hash after OAuth fallback", () => {
  assert.equal(
    buildLocalhostAuthForwardUrl({
      configuredSiteUrl: "https://tensr.systems",
      href: "http://localhost:3000/#",
    }),
    "https://tensr.systems/#"
  );
});

test("buildLocalhostAuthForwardUrl should ignore non-auth local pages", () => {
  assert.equal(
    buildLocalhostAuthForwardUrl({
      configuredSiteUrl: "https://tensr.systems",
      href: "http://localhost:3000/services",
    }),
    ""
  );
});

test("buildCanonicalAuthForwardUrl should prioritize misplaced auth hash callbacks", () => {
  assert.equal(
    buildCanonicalAuthForwardUrl({
      configuredSiteUrl: "https://tensr.systems",
      href: "http://localhost:3000/#access_token=abc",
    }),
    "https://tensr.systems/auth/callback/#access_token=abc"
  );
});

test("buildAuthHashForwardUrl should not redirect an existing callback route", () => {
  assert.equal(
    buildAuthHashForwardUrl({
      configuredSiteUrl: "https://tensr.systems",
      href: "https://tensr.systems/auth/callback/#access_token=abc",
    }),
    ""
  );
});

test("redirectMisplacedAuthHash should replace the browser location when needed", () => {
  const calls = [];
  const redirected = redirectMisplacedAuthHash({
    configuredSiteUrl: "https://tensr.systems",
    href: "http://localhost:3000/#access_token=abc",
    location: {
      replace(url) {
        calls.push(url);
      },
    },
  });

  assert.equal(redirected, true);
  assert.deepEqual(calls, ["https://tensr.systems/auth/callback/#access_token=abc"]);
});
