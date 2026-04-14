import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureCustomerConversation,
  getLiveChatAuthSnapshot,
  sendCustomerChatMessage,
} from './liveChatService.js';

function createQuery(result) {
  return {
    eq() {
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return this;
    },
    maybeSingle: async () => result.maybeSingle || { data: null, error: null },
    single: async () => result.single || { data: null, error: null },
    select() {
      return this;
    },
    insert() {
      return {
        select() {
          return {
            single: async () => result.insertSingle || { data: null, error: null },
          };
        },
      };
    },
    update() {
      return {
        eq() {
          return this;
        },
        select() {
          return {
            single: async () => result.updateSelect || { data: null, error: null },
          };
        },
      };
    },
  };
}

function createMockClient(config = {}) {
  return {
    auth: {
      async getUser() {
        return { data: { user: config.user || null } };
      },
    },
    from(tableName) {
      if (tableName === 'user_profiles') {
        return createQuery({ maybeSingle: config.profileResponse });
      }
      if (tableName === 'app_users') {
        return createQuery({ maybeSingle: config.legacyResponse });
      }
      if (tableName === 'support_conversations') {
        return createQuery({
          maybeSingle: config.conversationResponse,
          insertSingle: config.createdConversationInsertResponse,
          updateSelect: config.updatedConversationResponse,
        });
      }
      if (tableName === 'support_chat_messages') {
        return createQuery({
          insertSingle: config.messageInsertResponse,
        });
      }

      throw new Error(`Unexpected table: ${tableName}`);
    },
  };
}

test('getLiveChatAuthSnapshot should merge auth and profile data', async () => {
  const snapshot = await getLiveChatAuthSnapshot(
    createMockClient({
      user: { id: 'user-1', email: 'user@example.com' },
      profileResponse: { data: { full_name: 'Test User', phone: '0790000000' }, error: null },
      legacyResponse: { data: { full_name: 'Legacy User', email: 'legacy@example.com' }, error: null },
    })
  );

  assert.equal(snapshot.user.id, 'user-1');
  assert.deepEqual(snapshot.profile, {
    fullName: 'Test User',
    phone: '0790000000',
    email: 'legacy@example.com',
  });
});

test('ensureCustomerConversation should reuse the existing open conversation', async () => {
  const snapshot = await ensureCustomerConversation(
    {
      user: { id: 'user-1', email: 'user@example.com' },
      profile: { fullName: 'Test User' },
    },
    createMockClient({
      conversationResponse: { data: { id: 'conv-1', status: 'open' }, error: null },
    })
  );

  assert.equal(snapshot.conversation.id, 'conv-1');
  assert.equal(snapshot.error, '');
});

test('sendCustomerChatMessage should return a validation error for blank drafts', async () => {
  const snapshot = await sendCustomerChatMessage(
    {
      user: { id: 'user-1', email: 'user@example.com' },
      profile: { fullName: 'Test User' },
      conversation: { id: 'conv-1', status: 'open' },
      body: '   ',
    },
    createMockClient({
      messageInsertResponse: { data: null, error: null },
      updatedConversationResponse: { data: { id: 'conv-1', status: 'open' }, error: null },
    })
  );

  assert.match(snapshot.error, /اكتب رسالتك أولاً/);
});
