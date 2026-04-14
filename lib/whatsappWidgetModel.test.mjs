import test from "node:test";
import assert from "node:assert/strict";
import {
  WHATSAPP_WELCOME_AUTO_HIDE_MS,
  WHATSAPP_WELCOME_DELAY_MS,
  WHATSAPP_WELCOME_MESSAGE,
  shouldRenderWhatsappWidget,
  shouldScheduleWhatsappWelcome,
} from "./whatsappWidgetModel.js";

test("shouldRenderWhatsappWidget should require a WhatsApp href and public pathname", () => {
  assert.equal(shouldRenderWhatsappWidget({ href: "", pathname: "/" }), false);
  assert.equal(shouldRenderWhatsappWidget({ href: "https://wa.me/962", pathname: "/auth/login" }), false);
  assert.equal(shouldRenderWhatsappWidget({ href: "https://wa.me/962", pathname: "/admin" }), false);
  assert.equal(shouldRenderWhatsappWidget({ href: "https://wa.me/962", pathname: "/products" }), true);
});

test("shouldScheduleWhatsappWelcome should skip scheduling after the session has seen it", () => {
  assert.equal(
    shouldScheduleWhatsappWelcome({
      hasSeenSession: true,
      href: "https://wa.me/962",
      pathname: "/",
    }),
    false
  );

  assert.equal(
    shouldScheduleWhatsappWelcome({
      hasSeenSession: false,
      href: "https://wa.me/962",
      pathname: "/contact",
    }),
    true
  );
});

test("whatsapp widget constants should keep the expected timings and message copy", () => {
  assert.equal(WHATSAPP_WELCOME_DELAY_MS, 5000);
  assert.equal(WHATSAPP_WELCOME_AUTO_HIDE_MS, 7000);
  assert.equal(WHATSAPP_WELCOME_MESSAGE, "مرحباً! هل تحتاج مساعدة في اختيار المنتج المناسب؟");
});
