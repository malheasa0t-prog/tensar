import assert from "node:assert/strict";
import test from "node:test";

import {
  installSanitizedInnerHtmlGuard,
  isSafeAdminHtmlUrl,
  sanitizeAdminHtmlMarkup,
  sanitizeAdminInlineStyle,
} from "./htmlSanitizer.js";

test("isSafeAdminHtmlUrl should allow relative and https URLs only", () => {
  assert.equal(isSafeAdminHtmlUrl("/images/service.jpg"), true);
  assert.equal(isSafeAdminHtmlUrl("https://example.com/image.jpg"), true);
  assert.equal(isSafeAdminHtmlUrl("javascript:alert(1)"), false);
});

test("sanitizeAdminInlineStyle should strip dangerous inline style payloads", () => {
  assert.equal(sanitizeAdminInlineStyle("color:red"), "color:red");
  assert.equal(sanitizeAdminInlineStyle("background:url(javascript:alert(1))"), "");
});

test("sanitizeAdminHtmlMarkup should strip scripts event handlers and unsafe URLs", () => {
  const result = sanitizeAdminHtmlMarkup(
    '<div onclick="alert(1)"><img src="javascript:alert(1)"><script>alert(1)</script><a href="/safe">safe</a></div>'
  );

  assert.equal(result.includes("onclick"), false);
  assert.equal(result.includes("<script>"), false);
  assert.equal(result.includes('src="javascript:alert(1)"'), false);
  assert.equal(result.includes('href="/safe"'), true);
});

test("installSanitizedInnerHtmlGuard should sanitize future innerHTML assignments", () => {
  function FakeElement() {
    this.html = "";
  }

  Object.defineProperty(FakeElement.prototype, "innerHTML", {
    configurable: true,
    enumerable: true,
    get() {
      return this.html;
    },
    set(value) {
      this.html = String(value);
    },
  });

  const installed = installSanitizedInnerHtmlGuard({ elementCtor: FakeElement });
  const element = new FakeElement();

  element.innerHTML = '<button onclick="alert(1)">Retry</button>';

  assert.equal(installed, true);
  assert.equal(element.innerHTML, "<button>Retry</button>");
});
