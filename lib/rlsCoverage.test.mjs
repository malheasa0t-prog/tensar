import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const SCHEMA_FILES = Object.freeze([
  "db/complete_database_setup.sql",
  "db/schema.sql",
  "db/techfix_final_schema.sql",
]);

/**
 * Lists public tables declared in one SQL file.
 *
 * @param {string} sql
 * @returns {string[]}
 */
function listPublicTables(sql) {
  return [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi)]
    .map((match) => match[1].toLowerCase())
    .filter((table, index, tables) => tables.indexOf(table) === index)
    .sort();
}

/**
 * Returns whether one table has RLS explicitly enabled in SQL.
 *
 * @param {{ sql: string, table: string }} input
 * @returns {boolean}
 */
function hasRlsEnabled(input) {
  const escapedTable = input.table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `alter\\s+table\\s+public\\.${escapedTable}\\s+enable\\s+row\\s+level\\s+security`,
    "i"
  );
  return pattern.test(input.sql);
}

test("SQL schemas should enable row level security for every public table", () => {
  for (const schemaFile of SCHEMA_FILES) {
    const sql = fs.readFileSync(schemaFile, "utf8");
    const missingTables = listPublicTables(sql).filter((table) => !hasRlsEnabled({ sql, table }));

    assert.deepEqual(missingTables, [], `${schemaFile} is missing RLS on: ${missingTables.join(", ")}`);
  }
});
