import assert from "node:assert/strict";
import test from "node:test";
import { hydrateDepositProofUrls, resolveDepositProofPath } from "./depositProofUrls.js";

/**
 * Creates a minimal Supabase storage client stub.
 *
 * @returns {{ client: Record<string, unknown>, signedPaths: string[] }}
 */
function createStorageClient() {
  const signedPaths = [];

  return {
    signedPaths,
    client: {
      storage: {
        from(bucket) {
          return {
            async createSignedUrl(path) {
              signedPaths.push(`${bucket}:${path}`);
              return { data: { signedUrl: `https://signed.example.com/${path}` }, error: null };
            },
          };
        },
      },
    },
  };
}

test("resolveDepositProofPath should accept safe storage object paths", () => {
  assert.equal(resolveDepositProofPath("user-1/proof.png"), "user-1/proof.png");
  assert.equal(
    resolveDepositProofPath("https://demo.supabase.co/storage/v1/object/public/deposits/user-1/proof.png"),
    "user-1/proof.png"
  );
});

test("resolveDepositProofPath should reject traversal and malformed paths", () => {
  assert.equal(resolveDepositProofPath("../secret.png"), "");
  assert.equal(resolveDepositProofPath("user-1/%2e%2e/secret.png"), "");
  assert.equal(
    resolveDepositProofPath("https://demo.supabase.co/storage/v1/object/public/deposits/user-1/%2e%2e/secret.png"),
    ""
  );
});

test("hydrateDepositProofUrls should not sign rejected storage paths", async () => {
  const { client, signedPaths } = createStorageClient();
  const result = await hydrateDepositProofUrls(client, {
    id: "dep-1",
    proof_url: "https://demo.supabase.co/storage/v1/object/public/deposits/user-1/%2e%2e/secret.png",
  });

  assert.equal(result.proof_url, null);
  assert.deepEqual(signedPaths, []);
});
