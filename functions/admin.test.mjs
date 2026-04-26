import assert from "node:assert/strict";
import test from "node:test";

import { buildAdminRedirectHeaders, onRequest } from "./admin.js";

test("buildAdminRedirectHeaders should preserve the current query string", () => {
  const headers = buildAdminRedirectHeaders(new URL("https://tensr.systems/admin?section=customers"));

  assert.equal(headers.Location, "https://tensr.systems/admin.html?section=customers");
  assert.equal(headers["Cache-Control"], "private, no-store, max-age=0");
  assert.equal(headers["X-Robots-Tag"], "noindex, nofollow, noarchive");
});

test("onRequest should redirect /admin traffic to /admin.html", async () => {
  const response = onRequest({
    request: new Request("https://tensr.systems/admin?section=customers"),
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), "https://tensr.systems/admin.html?section=customers");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
});
