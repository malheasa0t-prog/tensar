import assert from "node:assert/strict";
import test from "node:test";
import { buildMobileAccountLinks, resolveMobileMenuIcon } from "./mobileMenuModel.js";

test("resolveMobileMenuIcon should map known public routes", () => {
  assert.equal(resolveMobileMenuIcon("/"), "house");
  assert.equal(resolveMobileMenuIcon("/products"), "wrench");
  assert.equal(resolveMobileMenuIcon("/compare"), "compare");
});

test("buildMobileAccountLinks should return guest actions when the user is signed out", () => {
  const links = buildMobileAccountLinks({ hasUser: false });

  assert.deepEqual(
    links.map((item) => item.href),
    ["/auth/login", "/auth/register"]
  );
});

test("buildMobileAccountLinks should include notification and favorite badges", () => {
  const links = buildMobileAccountLinks({
    favoriteCount: 3,
    hasUser: true,
    unreadNotifications: 5,
  });

  assert.equal(links[2].badge, "5");
  assert.equal(links[3].badge, "3");
});
