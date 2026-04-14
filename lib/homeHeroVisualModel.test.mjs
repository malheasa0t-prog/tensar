import test from "node:test";
import assert from "node:assert/strict";
import {
  getHeroStageHighlights,
  getHeroVisualItems,
} from "./homeHeroVisualModel.js";

test("getHeroVisualItems should prefer featured categories and fill the remaining stage slots", () => {
  const result = getHeroVisualItems([
    { id: "gaming", name: "ألعاب", icon: "gamepad", image: "/gaming.webp" },
  ]);

  assert.deepEqual(result, {
    primaryItem: {
      id: "gaming",
      name: "ألعاب",
      icon: "gamepad",
      image: "/gaming.webp",
    },
    floatingItems: [
      {
        id: "hero-repairs",
        name: "صيانة احترافية",
        icon: "wrench",
        image: "",
      },
      {
        id: "hero-accessories",
        name: "إكسسوارات أصلية",
        icon: "headphones",
        image: "",
      },
    ],
  });
});

test("getHeroVisualItems should fall back to the default cards when no categories are available", () => {
  const result = getHeroVisualItems(null);

  assert.equal(result.primaryItem.id, "hero-builds");
  assert.equal(result.floatingItems.length, 2);
});

test("getHeroStageHighlights should keep valid trust-bar items only", () => {
  const result = getHeroStageHighlights([
    { icon: "truck", title: "توصيل سريع", subtitle: "خلال 24 ساعة" },
    { icon: "", title: "", subtitle: "يجب تجاهل هذا" },
    { icon: "shield-check", title: "ضمان", subtitle: "حماية موثوقة" },
  ]);

  assert.deepEqual(result, [
    { icon: "truck", title: "توصيل سريع", subtitle: "خلال 24 ساعة" },
    { icon: "shield-check", title: "ضمان", subtitle: "حماية موثوقة" },
  ]);
});

test("getHeroStageHighlights should use defaults when the input is invalid", () => {
  const result = getHeroStageHighlights(undefined);

  assert.equal(result.length, 3);
  assert.equal(result[0].title, "توصيل سريع");
});
