import assert from "node:assert/strict";
import test from "node:test";
import {
  KEYBOARD_SHORTCUT_ACTIONS,
  getKeyboardShortcutAction,
} from "./keyboardShortcutsModel.js";

test("getKeyboardShortcutAction should match supported shortcuts", () => {
  assert.equal(getKeyboardShortcutAction({ ctrlKey: true, key: "k" }), KEYBOARD_SHORTCUT_ACTIONS.search);
  assert.equal(getKeyboardShortcutAction({ key: "/" }), KEYBOARD_SHORTCUT_ACTIONS.search);
  assert.equal(getKeyboardShortcutAction({ key: "c" }), KEYBOARD_SHORTCUT_ACTIONS.cart);
  assert.equal(getKeyboardShortcutAction({ key: "t" }), KEYBOARD_SHORTCUT_ACTIONS.theme);
  assert.equal(getKeyboardShortcutAction({ key: "Escape" }), KEYBOARD_SHORTCUT_ACTIONS.close);
});

test("getKeyboardShortcutAction should ignore unsupported or blocked combos", () => {
  assert.equal(getKeyboardShortcutAction({ altKey: true, key: "c" }), "");
  assert.equal(getKeyboardShortcutAction({ ctrlKey: true, key: "c" }), "");
  assert.equal(getKeyboardShortcutAction({ key: "z" }), "");
});
