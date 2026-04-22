import assert from "node:assert/strict";
import test from "node:test";

import {
  buildErrorPayload,
  extractErrorCode,
  formatErrorMessage,
} from "./errorCodes.js";

test("extractErrorCode should return the bracketed module code", () => {
  assert.equal(
    extractErrorCode("[CHK-107] \u0627\u0644\u0643\u0645\u064a\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u062a\u062a\u062c\u0627\u0648\u0632 \u0627\u0644\u0645\u062a\u0648\u0641\u0631"),
    "CHK-107"
  );
});

test("extractErrorCode should return null when the message has no code", () => {
  assert.equal(extractErrorCode("\u062d\u062f\u062b \u062e\u0637\u0623 \u063a\u064a\u0631 \u0645\u062a\u0648\u0642\u0639"), null);
});

test("formatErrorMessage should prefix messages with the normalized code", () => {
  assert.equal(
    formatErrorMessage("adm-201", "\u063a\u064a\u0631 \u0645\u0635\u0631\u062d"),
    "[ADM-201] \u063a\u064a\u0631 \u0645\u0635\u0631\u062d"
  );
});

test("buildErrorPayload should include both the error text and parsed code", () => {
  assert.deepEqual(
    buildErrorPayload("[PRF-301] \u0641\u0634\u0644 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062e\u0635\u064a"),
    {
      success: false,
      error: "[PRF-301] \u0641\u0634\u0644 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062e\u0635\u064a",
      code: "PRF-301",
    }
  );
});

test("buildErrorPayload should keep uncoded errors backward compatible", () => {
  assert.deepEqual(buildErrorPayload("Failed to load profile"), {
    success: false,
    error: "Failed to load profile",
  });
});
