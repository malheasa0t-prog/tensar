import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  extractCreatedTables,
  extractRlsEnabledTables,
  findTablesMissingRls,
  findUnsafePublicWritePolicies,
} from "./rlsAuditModel.js";

test("RLS audit helpers should detect missing RLS on created tables", () => {
  const sql = `
    CREATE TABLE public.orders (id uuid primary key);
    CREATE TABLE public.products (id uuid primary key);
    ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
  `;

  assert.deepEqual(extractCreatedTables(sql), ["orders", "products"]);
  assert.deepEqual(extractRlsEnabledTables(sql), ["orders"]);
  assert.deepEqual(findTablesMissingRls(sql), ["products"]);
});

test("RLS audit helpers should detect broad public write policies", () => {
  const sql = `
    CREATE POLICY unsafe_insert ON public.orders FOR INSERT WITH CHECK (true);
    CREATE POLICY public_read ON public.products FOR SELECT USING (true);
  `;

  assert.equal(findUnsafePublicWritePolicies(sql).length, 1);
});

test("techfix_final_schema should enable RLS for every created table", () => {
  const schemaSql = readFileSync(new URL("../db/techfix_final_schema.sql", import.meta.url), "utf8");

  assert.deepEqual(findTablesMissingRls(schemaSql), []);
});

test("techfix_final_schema should not contain unrestricted public write policies", () => {
  const schemaSql = readFileSync(new URL("../db/techfix_final_schema.sql", import.meta.url), "utf8");

  assert.deepEqual(findUnsafePublicWritePolicies(schemaSql), []);
});
