import test from "node:test";
import assert from "node:assert/strict";
import {
  FAVORITES_MAX_ITEMS,
  FAVORITES_STORAGE_KEY,
  hasFavoriteId,
  normalizeFavoriteIds,
  parseFavoriteIds,
  removeFavoriteId,
  toggleFavoriteId,
} from "./favoritesModel.js";

test("normalizeFavoriteIds should keep unique non-empty string ids only", () => {
  assert.deepEqual(normalizeFavoriteIds([1, "1", "", "  ", "abc", "abc"]), ["1", "abc"]);
  assert.equal(FAVORITES_STORAGE_KEY, "tz_favorites");
});

test("parseFavoriteIds should return an empty list for invalid payloads", () => {
  assert.deepEqual(parseFavoriteIds(""), []);
  assert.deepEqual(parseFavoriteIds("not-json"), []);
  assert.deepEqual(parseFavoriteIds(JSON.stringify({ id: 1 })), []);
});

test("hasFavoriteId should detect saved items using normalized ids", () => {
  assert.equal(hasFavoriteId(["10", "20"], 10), true);
  assert.equal(hasFavoriteId(["10", "20"], "30"), false);
});

test("removeFavoriteId should remove the requested product id safely", () => {
  assert.deepEqual(removeFavoriteId(["10", "20"], "10"), ["20"]);
  assert.deepEqual(removeFavoriteId(["10", "20"], ""), ["10", "20"]);
});

test("toggleFavoriteId should add and remove ids predictably", () => {
  assert.deepEqual(toggleFavoriteId(["10"], "20"), {
    favoriteIds: ["10", "20"],
    isFavorite: true,
    isAtLimit: false,
  });

  assert.deepEqual(toggleFavoriteId(["10", "20"], "20"), {
    favoriteIds: ["10"],
    isFavorite: false,
    isAtLimit: false,
  });
});

test("toggleFavoriteId should refuse to add beyond FAVORITES_MAX_ITEMS", () => {
  const fullList = Array.from({ length: FAVORITES_MAX_ITEMS }, (_, index) => `id-${index}`);
  const result = toggleFavoriteId(fullList, "new-id");

  assert.equal(result.isAtLimit, true);
  assert.equal(result.isFavorite, false);
  assert.deepEqual(result.favoriteIds, fullList);
});

test("toggleFavoriteId should still allow removal when at the limit", () => {
  const fullList = Array.from({ length: FAVORITES_MAX_ITEMS }, (_, index) => `id-${index}`);
  const result = toggleFavoriteId(fullList, "id-0");

  assert.equal(result.isAtLimit, false);
  assert.equal(result.isFavorite, false);
  assert.equal(result.favoriteIds.length, FAVORITES_MAX_ITEMS - 1);
});
