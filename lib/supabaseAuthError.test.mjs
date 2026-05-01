/**
 * Tests for Supabase auth error helpers.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { isMissingAuthSessionError } from "./supabaseAuthError.js";

test("isMissingAuthSessionError should detect Supabase missing-session errors", () => {
  assert.equal(
    isMissingAuthSessionError({
      message: "Auth session missing!",
      name: "AuthSessionMissingError",
    }),
    true
  );
});

test("isMissingAuthSessionError should reject unrelated auth errors", () => {
  assert.equal(isMissingAuthSessionError({ message: "JWT expired" }), false);
});
