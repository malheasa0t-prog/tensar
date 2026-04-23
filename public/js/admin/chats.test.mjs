import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./chats.helpers.js", import.meta.url), "utf8");

function normalizeValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadChatHooks() {
  const window = {
    __ENABLE_ADMIN_CHATS_TEST_HOOKS__: true,
  };
  const context = { window };

  vm.createContext(context);
  vm.runInContext(SCRIPT_SOURCE, context, { filename: "public/js/admin/chats.helpers.js" });

  return window.__adminChatsTestHooks;
}

test("sortAdminChatConversations should keep the newest conversation first", () => {
  const hooks = loadChatHooks();
  const conversations = hooks.sortAdminChatConversations([
    { id: "conv-1", last_message_at: "2026-04-06T08:00:00.000Z" },
    { id: "conv-2", last_message_at: "2026-04-06T09:00:00.000Z" },
  ]);

  assert.deepEqual(
    normalizeValue(conversations.map((item) => item.id)),
    ["conv-2", "conv-1"]
  );
});

test("getAdminChatStatusLabel should surface pending replies for open customer messages", () => {
  const hooks = loadChatHooks();

  assert.equal(
    hooks.getAdminChatStatusLabel({ status: "open", last_message_sender_role: "customer" }),
    "بانتظار الرد"
  );
});

test("buildAdminConversationUpdate should set the last sender to admin", () => {
  const hooks = loadChatHooks();
  const payload = hooks.buildAdminConversationUpdate("تم الرد");

  assert.equal(payload.status, "open");
  assert.equal(payload.last_message_sender_role, "admin");
  assert.equal(payload.last_message_preview, "تم الرد");
});

test("buildAdminReplyNotification should create a chat notification payload", () => {
  const hooks = loadChatHooks();
  const payload = hooks.buildAdminReplyNotification(
    { user_id: "user-1", id: "conv-1" },
    "سنراجع طلبك خلال دقائق"
  );

  assert.deepEqual(normalizeValue(payload), {
    user_id: "user-1",
    title: "رد جديد على محادثتك المباشرة",
    body: "سنراجع طلبك خلال دقائق",
    type: "info",
    reference_type: "chat",
    reference_id: "conv-1",
  });
});

test("filterAdminChatConversations should keep pending rows when requested", () => {
  const hooks = loadChatHooks();
  const conversations = hooks.filterAdminChatConversations({
    conversations: [
      { id: "conv-1", status: "open", last_message_sender_role: "customer", customer_name: "Ali" },
      { id: "conv-2", status: "open", last_message_sender_role: "admin", customer_name: "Sara" },
      { id: "conv-3", status: "closed", last_message_sender_role: "customer", customer_name: "Omar" },
    ],
    statusFilter: "pending",
    searchQuery: "",
  });

  assert.deepEqual(
    normalizeValue(conversations.map((item) => item.id)),
    ["conv-1"]
  );
});

test("buildAdminChatSummary should count open pending and closed conversations", () => {
  const hooks = loadChatHooks();
  const summary = hooks.buildAdminChatSummary([
    { status: "open", last_message_sender_role: "customer" },
    { status: "open", last_message_sender_role: "admin" },
    { status: "closed", last_message_sender_role: "admin" },
  ]);

  assert.deepEqual(normalizeValue(summary), {
    total: 3,
    open: 1,
    pending: 1,
    closed: 1,
  });
});
