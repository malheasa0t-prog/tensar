import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureDepositProofBucket,
  uploadDepositProofFile,
  validateDepositProofFile,
} from "./depositProofUploadService.js";

function createStorageApi({
  bucketData = null,
  bucketError = { message: "Bucket not found" },
  createBucketError = null,
  uploadError = null,
  publicUrl = "https://cdn.example.com/deposits/proof.png",
} = {}) {
  const calls = [];
  return {
    calls,
    storageApi: {
      async getBucket(bucketName) {
        calls.push({ type: "getBucket", bucketName });
        return { data: bucketData, error: bucketData ? null : bucketError };
      },
      async createBucket(bucketName, options) {
        calls.push({ type: "createBucket", bucketName, options });
        return { error: createBucketError };
      },
      from(bucketName) {
        calls.push({ type: "from", bucketName });
        return {
          async upload(path, file, options) {
            calls.push({ type: "upload", path, file, options });
            return { error: uploadError };
          },
          getPublicUrl(path) {
            calls.push({ type: "getPublicUrl", path });
            return { data: { publicUrl } };
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

  assert.equal(calls[0].type, "getBucket");
  assert.equal(calls[1].type, "createBucket");
  assert.equal(calls[1].bucketName, "deposits");
});

test("uploadDepositProofFile should upload into the deposits bucket after ensuring it exists", async () => {
  const { storageApi, calls } = createStorageApi();

  const publicUrl = await uploadDepositProofFile({
    storageApi,
    proofFile: { name: "proof.png", type: "image/png", size: 128 },
    userId: "user-1",
    now: () => 20,
  });

  assert.equal(publicUrl, "https://cdn.example.com/deposits/proof.png");
  assert.deepEqual(calls.slice(0, 5), [
    { type: "getBucket", bucketName: "deposits" },
    {
      type: "createBucket",
      bucketName: "deposits",
      options: {
        public: true,
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
    { type: "getPublicUrl", path: "user-1/20.png" },
  ]);
});

test("uploadDepositProofFile should surface storage upload failures", async () => {
  const { storageApi } = createStorageApi({
    uploadError: { message: "upload failed" },
  });

  await assert.rejects(
    () =>
      uploadDepositProofFile({
        storageApi,
        proofFile: { name: "proof.png", type: "image/png", size: 128 },
        userId: "user-1",
      }),
    /upload failed/
  );
});
