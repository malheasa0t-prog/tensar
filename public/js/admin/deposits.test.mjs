import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./deposits.js", import.meta.url), "utf8");

function normalizeValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadDepositHooks() {
  const window = {
    __ENABLE_DEPOSIT_ADMIN_TEST_HOOKS__: true,
    AdminApp: {
      sections: {},
      showToast() {},
      adminContent: { innerHTML: "" },
    },
  };
  const document = {
    querySelectorAll() {
      return [];
    },
    getElementById() {
      return null;
    },
  };
  const context = {
    window,
    document,
    confirm() {
      return false;
    },
    prompt() {
      return "";
    },
  };

  vm.createContext(context);
  vm.runInContext(SCRIPT_SOURCE, context, { filename: "public/js/admin/deposits.js" });

  return window.__depositAdminTestHooks;
}

function createNotificationClient({ updateData = [], updateError = null, insertError = null } = {}) {
  const calls = [];

  return {
    calls,
    client: {
      from(tableName) {
        assert.equal(tableName, "notifications");

        return {
          update(payload) {
            calls.push({ type: "update", payload });
            const filters = [];
            const chain = {
              eq(column, value) {
                filters.push({ column, value });
                return chain;
              },
              async select(columns) {
                calls.push({ type: "update-select", columns, filters: [...filters] });
                return { data: updateData, error: updateError };
              },
            };
            return chain;
          },
          async insert(rows) {
            calls.push({ type: "insert", rows });
            return { data: rows, error: insertError };
          },
        };
      },
    },
  };
}

test("getRpcAdjustmentRow should return the first row from RPC arrays", () => {
  const hooks = loadDepositHooks();

  const result = hooks.getRpcAdjustmentRow({
    data: [{ transaction_id: "tx-1" }, { transaction_id: "tx-2" }],
  });

  assert.deepEqual(result, { transaction_id: "tx-1" });
});

test("buildApprovedDepositNotification should create a deposit success notification", () => {
  const hooks = loadDepositHooks();

  const result = hooks.buildApprovedDepositNotification({
    userId: "user-1",
    amount: 12,
    depositId: "dep-1",
  });

  assert.deepEqual(normalizeValue(result), {
    user_id: "user-1",
    title: "تم شحن رصيدك بنجاح!",
    body: "تم إضافة 12.00 د.أ إلى محفظتك.",
    type: "success",
    reference_type: "deposit",
    reference_id: "dep-1",
  });
});

test("getDepositPayerPhone should read Orange Money phone metadata", () => {
  const hooks = loadDepositHooks();

  const result = hooks.getDepositPayerPhone({
    metadata: { orange_money_payer_phone: "0771234567" },
  });

  assert.equal(result, "0771234567");
});

test("updateWalletNotificationReference should retarget the wallet notification when a transaction exists", async () => {
  const hooks = loadDepositHooks();
  const { client, calls } = createNotificationClient({
    updateData: [{ id: "notif-1" }],
  });

  const didUpdate = await hooks.updateWalletNotificationReference({
    client,
    userId: "user-1",
    transactionId: "tx-1",
    payload: { title: "تم شحن رصيدك بنجاح!" },
  });

  assert.equal(didUpdate, true);
  assert.deepEqual(normalizeValue(calls), [
    { type: "update", payload: { title: "تم شحن رصيدك بنجاح!" } },
    {
      type: "update-select",
      columns: "id",
      filters: [
        { column: "user_id", value: "user-1" },
        { column: "reference_type", value: "wallet_transaction" },
        { column: "reference_id", value: "tx-1" },
      ],
    },
  ]);
});

test("insertApprovedDepositNotification should surface insert failures", async () => {
  const hooks = loadDepositHooks();
  const { client } = createNotificationClient({
    insertError: { message: "insert failed" },
  });

  await assert.rejects(
    () =>
      hooks.insertApprovedDepositNotification({
        client,
        payload: { reference_id: "dep-1" },
      }),
    /تعذر إنشاء إشعار الإيداع/
  );
});

test("ensureApprovedDepositNotification should insert a fallback notification when no wallet notification was updated", async () => {
  const hooks = loadDepositHooks();
  const { client, calls } = createNotificationClient({
    updateData: [],
  });

  await hooks.ensureApprovedDepositNotification({
    client,
    userId: "user-1",
    amount: 15,
    depositId: "dep-1",
    transactionId: "tx-1",
  });

  assert.deepEqual(normalizeValue(calls), [
    {
      type: "update",
      payload: {
        user_id: "user-1",
        title: "تم شحن رصيدك بنجاح!",
        body: "تم إضافة 15.00 د.أ إلى محفظتك.",
        type: "success",
        reference_type: "deposit",
        reference_id: "dep-1",
      },
    },
    {
      type: "update-select",
      columns: "id",
      filters: [
        { column: "user_id", value: "user-1" },
        { column: "reference_type", value: "wallet_transaction" },
        { column: "reference_id", value: "tx-1" },
      ],
    },
    {
      type: "insert",
      rows: [
        {
          user_id: "user-1",
          title: "تم شحن رصيدك بنجاح!",
          body: "تم إضافة 15.00 د.أ إلى محفظتك.",
          type: "success",
          reference_type: "deposit",
          reference_id: "dep-1",
        },
      ],
    },
  ]);
});
