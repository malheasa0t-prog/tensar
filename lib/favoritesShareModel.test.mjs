import assert from "node:assert/strict";
import test from "node:test";
import {
  FAVORITES_SHARE_QUERY_PARAM,
  buildFavoritesSharePath,
  buildFavoritesShareUrl,
  decodeFavoritesShareIds,
  encodeFavoritesShareIds,
} from "./favoritesShareModel.js";

test("encodeFavoritesShareIds should keep normalized unique ids only", () => {
  assert.equal(encodeFavoritesShareIds(["prd-1", "", "prd-2", "prd-1"]), "prd-1,prd-2");
});

test("decodeFavoritesShareIds should ignore empty and duplicate values", () => {
  assert.deepEqual(decodeFavoritesShareIds("prd-1,,prd-2,prd-1"), ["prd-1", "prd-2"]);
  assert.deepEqual(decodeFavoritesShareIds(""), []);
});

test("buildFavoritesSharePath should create a storefront route with the expected query key", () => {
  assert.equal(
    buildFavoritesSharePath(["prd-1", "prd-2"]),
    `/favorites/shared?${FAVORITES_SHARE_QUERY_PARAM}=prd-1%2Cprd-2`
  );
});

test("buildFavoritesShareUrl should return an absolute url when an origin is supplied", () => {
  assert.equal(
    buildFavoritesShareUrl({
      favoriteIds: ["prd-9"],
      origin: "https://tensar.pages.dev",
    }),
    "https://tensar.pages.dev/favorites/shared?items=prd-9"
  );
});
