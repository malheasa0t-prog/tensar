import assert from "node:assert/strict";
import test from "node:test";

import { translateProviderError } from "./provider.mjs";

test("translateProviderError should map known provider errors", () => {
  assert.equal(translateProviderError("INSUFFICIENT_BALANCE"), "رصيد المزود غير كافٍ.");
  assert.equal(translateProviderError("service-not-found"), "الخدمة غير موجودة عند المزود.");
});

test("translateProviderError should keep unknown provider errors readable", () => {
  assert.equal(translateProviderError("Custom provider failure"), "Custom provider failure");
});
