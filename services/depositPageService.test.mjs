import test from "node:test";
import assert from "node:assert/strict";
import {
  LOGIN_REQUIRED_MESSAGE,
  createDepositRequest,
  fetchDepositPageSnapshot,
} from "./depositPageService.js";

function createAuthClient(user) {
  return {
    auth: {
      async getUser() {
        return { data: { user } };
      },
    },
  };
}

test("fetchDepositPageSnapshot should return settings for guests", async () => {
  const client = createAuthClient(null);

  const result = await fetchDepositPageSnapshot({
    client,
    loadSettings: async () => ({
      depositTransfer: { bankName: "البنك العربي", iban: "JO00 TEST 1234" },
    }),
  });

  assert.deepEqual(result, {
    userId: "",
    deposits: [],
    depositTransfer: { bankName: "البنك العربي", iban: "JO00 TEST 1234" },
  });
});

test("fetchDepositPageSnapshot should load deposits for authenticated users", async () => {
  const client = {
    ...createAuthClient({ id: "user-1" }),
    from(tableName) {
      assert.equal(tableName, "deposits");
      return {
        select() {
          return {
            eq(columnName, value) {
              assert.equal(columnName, "user_id");
              assert.equal(value, "user-1");
              return {
                async order(columnToSort, options) {
                  assert.equal(columnToSort, "created_at");
                  assert.deepEqual(options, { ascending: false });
                  return {
                    data: [{ id: "dep-1", amount: 10 }],
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await fetchDepositPageSnapshot({
    client,
    loadSettings: async () => ({ depositTransfer: { bankName: "bank", iban: "iban" } }),
  });

  assert.deepEqual(result, {
    userId: "user-1",
    deposits: [{ id: "dep-1", amount: 10 }],
    depositTransfer: { bankName: "bank", iban: "iban" },
  });
});

test("fetchDepositPageSnapshot should surface deposit query failures", async () => {
  const client = {
    ...createAuthClient({ id: "user-1" }),
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async order() {
                  return { data: null, error: { message: "query failed" } };
                },
              };
            },
          };
        },
      };
    },
  };

  await assert.rejects(
    () =>
      fetchDepositPageSnapshot({
        client,
        loadSettings: async () => ({ depositTransfer: {} }),
      }),
    /تعذر تحميل سجل الإيداعات/
  );
});

test("createDepositRequest should reject guests", async () => {
  const client = createAuthClient(null);

  await assert.rejects(
    () =>
      createDepositRequest({
        client,
        amount: 5,
        proofFile: null,
      }),
    new RegExp(LOGIN_REQUIRED_MESSAGE)
  );
});

test("createDepositRequest should reject amounts below the minimum", async () => {
  const client = createAuthClient({ id: "user-1" });

  await assert.rejects(
    () =>
      createDepositRequest({
        client,
        amount: 0,
        proofFile: null,
      }),
    /الحد الأدنى للشحن/
  );
});

test("createDepositRequest should reject amounts above the maximum", async () => {
  const client = createAuthClient({ id: "user-1" });

  await assert.rejects(
    () =>
      createDepositRequest({
        client,
        amount: 10001,
        proofFile: null,
      }),
    /الحد الأقصى للشحن/
  );
});

test("createDepositRequest should upload proof and insert the deposit request", async () => {
  const uploadCalls = [];
  const insertCalls = [];
  const client = {
    ...createAuthClient({ id: "user-1" }),
    from(tableName) {
      assert.equal(tableName, "deposits");
      return {
        async insert(rows) {
          insertCalls.push(rows);
          return { error: null };
        },
      };
    },
  };

  const result = await createDepositRequest({
    client,
    amount: "25",
    proofFile: { name: "receipt.png", type: "image/png" },
    uploadProof: async (input) => {
      uploadCalls.push(input);
      return "https://cdn.example.com/proof.png";
    },
  });

  assert.deepEqual(result, { userId: "user-1" });
  assert.equal(uploadCalls.length, 1);
  assert.deepEqual(insertCalls, [
    [
      {
        user_id: "user-1",
        amount: 25,
        method: "manual",
        proof_url: "https://cdn.example.com/proof.png",
        status: "pending",
      },
    ],
  ]);
});

test("createDepositRequest should surface insert failures", async () => {
  const client = {
    ...createAuthClient({ id: "user-1" }),
    from() {
      return {
        async insert() {
          return { error: { message: "db failed" } };
        },
      };
    },
  };

  await assert.rejects(
    () =>
      createDepositRequest({
        client,
        amount: 5,
        proofFile: null,
        uploadProof: async () => null,
      }),
    /db failed/
  );
});
