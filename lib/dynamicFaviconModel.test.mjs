import assert from "node:assert/strict";
import test from "node:test";
import { buildDynamicFaviconState } from "./dynamicFaviconModel.js";

test("buildDynamicFaviconState should expose cart badge text and notification dot", () => {
  assert.deepEqual(buildDynamicFaviconState({ cartCount: 5, unreadCount: 2 }), {
    badgeText: "5",
    hasNotificationDot: true,
  });
});

test("buildDynamicFaviconState should clamp empty and large counts", () => {
  assert.deepEqual(buildDynamicFaviconState({ cartCount: 0, unreadCount: 0 }), {
    badgeText: "",
    hasNotificationDot: false,
  });
  assert.deepEqual(buildDynamicFaviconState({ cartCount: 200, unreadCount: 0 }), {
    badgeText: "99+",
    hasNotificationDot: false,
  });
});
