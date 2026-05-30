import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./services.js", import.meta.url), "utf8");

function loadServiceHooks() {
  const window = {
    __ENABLE_SERVICE_ADMIN_TEST_HOOKS__: true,
    AdminApp: {
      sections: {},
    },
  };
  const context = {
    TZ: {
      escapeHtml(value) {
        return String(value ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      },
    },
    window,
  };

  vm.createContext(context);
  vm.runInContext(SCRIPT_SOURCE, context, { filename: "public/js/admin/services.js" });

  return window.__serviceAdminTestHooks;
}

test("normalizeServiceImage should trim valid paths and clear blank values", () => {
  const hooks = loadServiceHooks();

  assert.equal(hooks.normalizeServiceImage(" https://example.com/service.jpg "), "https://example.com/service.jpg");
  assert.equal(hooks.normalizeServiceImage("   "), null);
  assert.equal(hooks.normalizeServiceImage(null), null);
});

test("buildServicePreviewMarkup should render an image when a valid source exists", () => {
  const hooks = loadServiceHooks();
  const markup = hooks.buildServicePreviewMarkup(" https://example.com/service.jpg ");

  assert.match(markup, /<img /);
  assert.match(markup, /https:\/\/example\.com\/service\.jpg/);
});

test("buildServicePreviewMarkup should render the fallback icon when no image exists", () => {
  const hooks = loadServiceHooks();
  const markup = hooks.buildServicePreviewMarkup("   ");

  assert.match(markup, /fa-image/);
});

test("buildServicePayload should keep the normalized image and numeric price", () => {
  const hooks = loadServiceHooks();
  const payload = hooks.buildServicePayload({
    category: "",
    description: "تشخيص شامل",
    duration: "يومان",
    image: " /images/repair-service.jpg ",
    name: "صيانة لابتوب",
    price: "18.5",
  });

  assert.equal(payload.name, "صيانة لابتوب");
  assert.equal(payload.category, null);
  assert.equal(payload.price, 18.5);
  assert.equal(payload.image, "/images/repair-service.jpg");
  assert.equal(payload.status, "active");
  assert.ok(Number.isFinite(Date.parse(payload.updated_at)));
});
