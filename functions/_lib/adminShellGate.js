/**
 * Shared Cloudflare Access gate helpers for the legacy admin shell.
 *
 * @module functions/_lib/adminShellGate
 */

const ADMIN_SHELL_ACCESS_MODE_ENV = "ADMIN_SHELL_ACCESS_MODE";
const ADMIN_SHELL_ALLOWED_DOMAINS_ENV = "ADMIN_SHELL_ALLOWED_DOMAINS";
const ADMIN_SHELL_ALLOWED_EMAILS_ENV = "ADMIN_SHELL_ALLOWED_EMAILS";
const CF_ACCESS_EMAIL_HEADER = "cf-access-authenticated-user-email";
const MODE_CF_ACCESS = "cf-access";
const MODE_DENY = "deny";
const MODE_PUBLIC = "public";

/**
 * Parses one comma-separated environment variable into normalized values.
 *
 * @param {string | undefined | null} rawValue - Raw environment variable value.
 * @returns {string[]} Normalized entries without empty values.
 */
function parseCommaSeparatedEnvValue(rawValue) {
  return String(rawValue || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Normalizes the configured admin shell access mode.
 *
 * @param {string | undefined | null} rawValue - Raw access mode value.
 * @returns {"cf-access" | "deny" | "public"} Normalized mode.
 */
function normalizeAdminShellAccessMode(rawValue) {
  const normalizedValue = String(rawValue || "").trim().toLowerCase();
  if (!normalizedValue) return MODE_PUBLIC;
  if ([MODE_CF_ACCESS, MODE_DENY, MODE_PUBLIC].includes(normalizedValue)) {
    return normalizedValue;
  }

  return MODE_DENY;
}

/**
 * Reads the admin shell access mode from runtime environment variables.
 *
 * @param {Record<string, string | undefined>} [env=process.env] - Environment bindings.
 * @returns {"cf-access" | "deny" | "public"} Active access mode.
 */
function getAdminShellAccessMode(env = process.env) {
  return normalizeAdminShellAccessMode(env?.[ADMIN_SHELL_ACCESS_MODE_ENV]);
}

/**
 * Reads the Cloudflare Access user email from one incoming request.
 *
 * @param {Request | null | undefined} request - Incoming request object.
 * @returns {string} Lower-cased authenticated email or an empty string.
 */
function getCloudflareAccessEmail(request) {
  return String(request?.headers?.get?.(CF_ACCESS_EMAIL_HEADER) || "")
    .trim()
    .toLowerCase();
}

/**
 * Reads the optional admin shell email allowlist.
 *
 * @param {Record<string, string | undefined>} [env=process.env] - Environment bindings.
 * @returns {string[]} Explicitly allowed email addresses.
 */
function getAllowedAdminShellEmails(env = process.env) {
  return parseCommaSeparatedEnvValue(env?.[ADMIN_SHELL_ALLOWED_EMAILS_ENV]);
}

/**
 * Reads the optional admin shell domain allowlist.
 *
 * @param {Record<string, string | undefined>} [env=process.env] - Environment bindings.
 * @returns {string[]} Explicitly allowed email domains.
 */
function getAllowedAdminShellDomains(env = process.env) {
  return parseCommaSeparatedEnvValue(env?.[ADMIN_SHELL_ALLOWED_DOMAINS_ENV]);
}

/**
 * Checks whether one email matches the optional address allowlist.
 *
 * @param {{ allowedEmails: string[], email: string }} input - Email matching input.
 * @returns {boolean} True when the email is allowed or the allowlist is empty.
 */
function matchesAllowedAdminEmail(input) {
  if (input.allowedEmails.length === 0) return true;
  return input.allowedEmails.includes(input.email);
}

/**
 * Checks whether one email matches the optional domain allowlist.
 *
 * @param {{ allowedDomains: string[], email: string }} input - Domain matching input.
 * @returns {boolean} True when the email domain is allowed or the allowlist is empty.
 */
function matchesAllowedAdminDomain(input) {
  if (input.allowedDomains.length === 0) return true;
  const emailDomain = input.email.split("@")[1] || "";
  return input.allowedDomains.includes(emailDomain);
}

/**
 * Evaluates whether the current request may receive the admin shell HTML.
 *
 * @param {{ env?: Record<string, string | undefined>, request: Request }} input - Evaluation input.
 * @returns {{ allowed: boolean, email: string, mode: string, reason: string }} Access result.
 */
function evaluateAdminShellAccess(input) {
  const env = input?.env || process.env;
  const mode = getAdminShellAccessMode(env);
  const email = getCloudflareAccessEmail(input?.request);
  const allowedEmails = getAllowedAdminShellEmails(env);
  const allowedDomains = getAllowedAdminShellDomains(env);

  if (mode === MODE_PUBLIC) {
    return { allowed: true, email, mode, reason: "public_mode" };
  }

  if (mode === MODE_DENY) {
    return { allowed: false, email, mode, reason: "deny_mode" };
  }

  if (!email) {
    return { allowed: false, email, mode, reason: "missing_cf_access_email" };
  }

  if (!matchesAllowedAdminEmail({ allowedEmails, email })) {
    return { allowed: false, email, mode, reason: "email_not_allowed" };
  }

  if (!matchesAllowedAdminDomain({ allowedDomains, email })) {
    return { allowed: false, email, mode, reason: "domain_not_allowed" };
  }

  return { allowed: true, email, mode, reason: "cf_access_allowed" };
}

export {
  ADMIN_SHELL_ACCESS_MODE_ENV,
  ADMIN_SHELL_ALLOWED_DOMAINS_ENV,
  ADMIN_SHELL_ALLOWED_EMAILS_ENV,
  MODE_CF_ACCESS,
  MODE_DENY,
  MODE_PUBLIC,
  evaluateAdminShellAccess,
  getAdminShellAccessMode,
  getAllowedAdminShellDomains,
  getAllowedAdminShellEmails,
  getCloudflareAccessEmail,
  normalizeAdminShellAccessMode,
};
