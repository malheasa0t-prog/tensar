import assert from "node:assert/strict";
import test from "node:test";
import {
  getThemeLabel,
  normalizeThemeValue,
  resolveInitialThemeValue,
  toggleThemeValue,
} from "./themeModel.js";

test("normalizeThemeValue should default to the dark brand theme", () => {
  assert.equal(normalizeThemeValue(undefined), "techfix");
  assert.equal(normalizeThemeValue("other"), "techfix");
});

test("normalizeThemeValue should keep the light theme when requested", () => {
  assert.equal(normalizeThemeValue("light"), "light");
});

test("toggleThemeValue should swap between the supported themes", () => {
  assert.equal(toggleThemeValue("techfix"), "light");
  assert.equal(toggleThemeValue("light"), "techfix");
});

test("resolveInitialThemeValue should prefer the stored theme over the system preference", () => {
  assert.equal(resolveInitialThemeValue({ prefersLight: true, storedTheme: "techfix" }), "techfix");
  assert.equal(resolveInitialThemeValue({ prefersLight: true }), "light");
});

test("getThemeLabel should return Arabic copy for both themes", () => {
  assert.equal(getThemeLabel("light"), "الوضع الفاتح");
  assert.equal(getThemeLabel("techfix"), "الوضع الداكن");
});
