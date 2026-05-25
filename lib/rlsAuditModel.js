/**
 * SQL helpers for auditing Supabase Row Level Security coverage.
 */

const CREATE_TABLE_PATTERN =
  /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"?public"?\.)?)(?:"?([a-zA-Z_][\w]*)"?)/gi;
const ENABLE_RLS_PATTERN =
  /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:(?:"?public"?\.)?)(?:"?([a-zA-Z_][\w]*)"?)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
const UNSAFE_POLICY_PATTERN =
  /CREATE\s+POLICY[\s\S]*?\bFOR\s+(?:ALL|INSERT|UPDATE|DELETE)\b[\s\S]*?(?:USING|WITH\s+CHECK)\s*\(\s*true\s*\)\s*;/gi;

/**
 * Extracts normalized table names from a SQL statement pattern.
 *
 * @param {RegExp} pattern - Global regular expression with the table name in group 1.
 * @param {string} sql - SQL text.
 * @returns {string[]} Unique lower-case table names.
 */
function extractTableNames(pattern, sql) {
  const names = [...String(sql || "").matchAll(pattern)]
    .map((match) => String(match[1] || "").trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(names)].sort();
}

/**
 * Returns all tables created by a SQL schema.
 *
 * @param {string} sql - SQL text.
 * @returns {string[]} Created table names.
 */
export function extractCreatedTables(sql) {
  return extractTableNames(CREATE_TABLE_PATTERN, sql);
}

/**
 * Returns all tables with explicit RLS enabled in a SQL schema.
 *
 * @param {string} sql - SQL text.
 * @returns {string[]} RLS-enabled table names.
 */
export function extractRlsEnabledTables(sql) {
  return extractTableNames(ENABLE_RLS_PATTERN, sql);
}

/**
 * Finds schema tables that do not explicitly enable Row Level Security.
 *
 * @param {string} sql - SQL text.
 * @returns {string[]} Created tables without ENABLE ROW LEVEL SECURITY.
 */
export function findTablesMissingRls(sql) {
  const enabledTables = new Set(extractRlsEnabledTables(sql));
  return extractCreatedTables(sql).filter((tableName) => !enabledTables.has(tableName));
}

/**
 * Finds broad public write policies that allow unrestricted writes.
 *
 * @param {string} sql - SQL text.
 * @returns {string[]} Matching policy snippets.
 */
export function findUnsafePublicWritePolicies(sql) {
  return [...String(sql || "").matchAll(UNSAFE_POLICY_PATTERN)]
    .map((match) => match[0].replace(/\s+/g, " ").trim());
}
