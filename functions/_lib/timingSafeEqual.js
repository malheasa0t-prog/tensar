/**
 * Constant-time string comparison helper for secret/token checks.
 *
 * Comparing secrets with `===` short-circuits on the first differing byte,
 * which leaks the secret one byte at a time through response-time differences.
 * Every comparison here iterates over the full max-length of both inputs so the
 * running time does not depend on where (or whether) the inputs diverge.
 */

/**
 * Compares two strings in constant time.
 *
 * Length-mismatched inputs still iterate to the longer length so a length
 * difference is not leaked through early-return timing.
 *
 * @param {string} candidate - Untrusted value supplied by the caller.
 * @param {string} expected - Trusted secret stored on the server.
 * @returns {boolean} True when both inputs are byte-for-byte identical.
 */
export function timingSafeEqualStrings(candidate, expected) {
  const candidateBytes = new TextEncoder().encode(String(candidate || ""));
  const expectedBytes = new TextEncoder().encode(String(expected || ""));
  const length = Math.max(candidateBytes.length, expectedBytes.length);
  let diff = candidateBytes.length ^ expectedBytes.length;
  for (let index = 0; index < length; index += 1) {
    const left = index < candidateBytes.length ? candidateBytes[index] : 0;
    const right = index < expectedBytes.length ? expectedBytes[index] : 0;
    diff |= left ^ right;
  }

  return diff === 0;
}
