import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureDepositProofBucket,
  uploadDepositProofFile,
  validateDepositProofFile,
} from "./depositProofUploadService.js";

/**
 * Creates a storage API stub for deposit proof upload tests.
 *
 * @param {{ bucketData?: unknown, bucketError?: { message?: string } | null, createBucketError?: { message?: string } | null, uploadError?: { message?: string } | null }} [options={}]
 * @returns {{ calls: Array<Record<string, unknown>>, storageApi: Record<string, unknown> }}
 */
function createStorageApi(options = {}) {
  const calls = [];
  return {
    calls,
    storageApi: {
      async getBucket(bucketName) {
        calls.push({ type: "getBucket", bucketName });
        return {
          data: options.bucketData ?? null,
          error: options.bucketData ? null : (options.bucketError || { message: "Bucket not found" }),
        };
      },
      async createBucket(bucketName, bucketOptions) {
        calls.push({ type: "createBucket", bucketName, options: bucketOptions });
        return { error: options.createBucketError ?? null };
      },
      from(bucketName) {
        calls.push({ type: "from", bucketName });
        return {
          async upload(path, file, uploadOptions) {
            calls.push({ type: "upload", path, file, options: uploadOptions });
            return { error: options.uploadError ?? null };
          },
        };
      },
    },
  };
}

test("validateDepositProofFile should reject invalid mime types", () => {
  const result = validateDepositProofFile({ type: "application/pdf", size: 10 });
  assert.match(result, /صورة صالحة/);
});

test("validateDepositProofFile should reject oversized files", () => {
  const result = validateDepositProofFile({
    type: "image/png",
    size: (5 * 1024 * 1024) + 1,
  });
  assert.match(result, /أكبر من الحد المسموح/);
});

test("ensureDepositProofBucket should create the bucket when it is missing", async () => {
  const { storageApi, calls } = createStorageApi();

  await ensureDepositProofBucket(storageApi);

  assert.deepEqual(calls.slice(0, 2), [
    { type: "getBucket", bucketName: "deposits" },
    {
      type: "createBucket",
      bucketName: "deposits",
      options: {
        public: false,
        fileSizeLimit: 5242880,
        allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
      },
    },
  ]);
});

test("uploadDepositProofFile should return the private object path after upload", async () => {
  const { storageApi, calls } = createStorageApi();

  const objectPath = await uploadDepositProofFile({
    storageApi,
    proofFile: { name: "proof.png", type: "image/png", size: 128 },
    userId: "user-1",
    now: () => 20,
  });

  assert.equal(objectPath, "user-1/20.png");
  assert.deepEqual(calls.slice(0, 4), [
    { type: "getBucket", bucketName: "deposits" },
    {
      type: "createBucket",
      bucketName: "deposits",
      options: {
        public: false,
        fileSizeLimit: 5242880,
        allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
      },
    },
    { type: "from", bucketName: "deposits" },
    {
      type: "upload",
      path: "user-1/20.png",
      file: { name: "proof.png", type: "image/png", size: 128 },
      options: { contentType: "image/png", upsert: false },
    },
  ]);
});

test("uploadDepositProofFile should surface storage upload failures", async () => {
  const { storageApi } = createStorageApi({
    uploadError: { message: "upload failed" },
  });

  await assert.rejects(
    () => uploadDepositProofFile({
      storageApi,
      proofFile: { name: "proof.png", type: "image/png", size: 128 },
      userId: "user-1",
    }),
    /upload failed/,
  );
});
