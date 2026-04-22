import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./error-codes.js", import.meta.url), "utf8");

/**
 * Executes the browser bundle in a sandbox and returns the exported API.
 *
 * @returns {{ ERROR_CODES: Record<string, string>, formatError: Function, getCustomerSafeMessage: Function }}
 */
function loadErrorCodesModule() {
  const context = vm.createContext({
    console: { error() {} },
    window: {},
  });

  vm.runInContext(SCRIPT_SOURCE, context, {
    filename: "public/js/admin/error-codes.js",
  });

  return context.window.AdminErrorCodes;
}

test("formatError should prefix uncoded messages with the provided code", () => {
  const errorCodes = loadErrorCodesModule();

  assert.equal(
    errorCodes.formatError("app-501", "\u062a\u0639\u0630\u0631 \u0627\u0633\u062a\u0643\u0645\u0627\u0644 \u0639\u0631\u0636 \u0627\u0644\u0635\u0641\u062d\u0629"),
    "[APP-501] \u062a\u0639\u0630\u0631 \u0627\u0633\u062a\u0643\u0645\u0627\u0644 \u0639\u0631\u0636 \u0627\u0644\u0635\u0641\u062d\u0629"
  );
});

test("formatError should not double-prefix an already coded message", () => {
  const errorCodes = loadErrorCodesModule();

  assert.equal(
    errorCodes.formatError("APP-501", "[APP-501] \u062a\u0639\u0630\u0631 \u0627\u0633\u062a\u0643\u0645\u0627\u0644 \u0639\u0631\u0636 \u0627\u0644\u0635\u0641\u062d\u0629"),
    "[APP-501] \u062a\u0639\u0630\u0631 \u0627\u0633\u062a\u0643\u0645\u0627\u0644 \u0639\u0631\u0636 \u0627\u0644\u0635\u0641\u062d\u0629"
  );
});

test("getCustomerSafeMessage should expose a support-friendly fallback", () => {
  const errorCodes = loadErrorCodesModule();

  assert.equal(
    errorCodes.getCustomerSafeMessage("chk-107"),
    "\u062d\u062f\u062b \u062e\u0637\u0623 (\u0631\u0645\u0632: CHK-107). \u062a\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u062f\u0639\u0645."
  );
});

test("ERROR_CODES should include admin order status and runtime modules", () => {
  const errorCodes = loadErrorCodesModule();

  assert.equal(typeof errorCodes.ERROR_CODES["APP-501"], "string");
  assert.equal(typeof errorCodes.ERROR_CODES["CKP-500"], "string");
  assert.equal(typeof errorCodes.ERROR_CODES["ORM-106"], "string");
  assert.equal(typeof errorCodes.ERROR_CODES["ORM-500"], "string");
  assert.equal(typeof errorCodes.ERROR_CODES["RBK-301"], "string");
  assert.equal(typeof errorCodes.ERROR_CODES["WLT-301"], "string");
});
