/**
 * Browser idempotency-key and submission-state helpers.
 */

const IDEMPOTENCY_FALLBACK_BYTES = 16;
const INVALID_SUBMISSION_STATE_MESSAGE = "[IDM-502] Submission state is required.";

/**
 * Generates a UUID v4 compatible idempotency key for retry-safe POST requests.
 *
 * @returns {string} UUID v4 string.
 */
export function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("[IDM-501] Secure random generator is unavailable.");
  }

  const bytes = new Uint8Array(IDEMPOTENCY_FALLBACK_BYTES);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

/**
 * Validates that one mutable submission-state container is present.
 *
 * @param {unknown} state - Candidate submission state object.
 * @returns {{ fingerprint: string, idempotencyKey: string, locked: boolean }} Validated submission state.
 * @throws {TypeError} When the state container is missing.
 */
function requireSubmissionState(state) {
  if (!state || typeof state !== "object") {
    throw new TypeError(INVALID_SUBMISSION_STATE_MESSAGE);
  }

  return /** @type {{ fingerprint: string, idempotencyKey: string, locked: boolean }} */ (state);
}

/**
 * Creates one mutable submission-state container for retry-safe forms.
 *
 * @returns {{ fingerprint: string, idempotencyKey: string, locked: boolean }} Fresh submission state.
 */
export function createSubmissionState() {
  return {
    fingerprint: "",
    idempotencyKey: "",
    locked: false,
  };
}

/**
 * Attempts to acquire the synchronous duplicate-submit lock.
 *
 * @param {{ fingerprint: string, idempotencyKey: string, locked: boolean }} state - Mutable submission state.
 * @returns {boolean} True when the caller acquired the lock.
 * @throws {TypeError} When the state container is missing.
 */
export function acquireSubmissionLock(state) {
  const submissionState = requireSubmissionState(state);
  if (submissionState.locked) {
    return false;
  }

  submissionState.locked = true;
  return true;
}

/**
 * Releases the synchronous duplicate-submit lock.
 *
 * @param {{ fingerprint: string, idempotencyKey: string, locked: boolean }} state - Mutable submission state.
 * @returns {void}
 * @throws {TypeError} When the state container is missing.
 */
export function releaseSubmissionLock(state) {
  requireSubmissionState(state).locked = false;
}

/**
 * Resolves one stable idempotency key for the current form fingerprint.
 *
 * Reuses the existing key while the fingerprint stays unchanged, and rotates
 * the key as soon as the user edits the payload.
 *
 * @param {{ fingerprint?: string, state: { fingerprint: string, idempotencyKey: string, locked: boolean } }} input
 * @returns {string} Stable idempotency key for the current payload snapshot.
 * @throws {TypeError} When the state container is missing.
 */
export function resolveSubmissionIdempotencyKey(input) {
  const submissionState = requireSubmissionState(input?.state);
  const fingerprint = String(input?.fingerprint || "");

  if (!submissionState.idempotencyKey || submissionState.fingerprint !== fingerprint) {
    submissionState.fingerprint = fingerprint;
    submissionState.idempotencyKey = createIdempotencyKey();
  }

  return submissionState.idempotencyKey;
}

/**
 * Clears the cached idempotency key after a completed submission.
 *
 * @param {{ fingerprint: string, idempotencyKey: string, locked: boolean }} state - Mutable submission state.
 * @returns {void}
 * @throws {TypeError} When the state container is missing.
 */
export function resetSubmissionIdempotencyKey(state) {
  const submissionState = requireSubmissionState(state);
  submissionState.fingerprint = "";
  submissionState.idempotencyKey = "";
}
