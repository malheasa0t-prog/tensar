import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIVE_CHAT_OPEN_STATUS,
  buildLiveChatConversationPayload,
  buildLiveChatConversationUpdate,
  buildLiveChatMessagePayload,
  buildLiveChatPreview,
  normalizeLiveChatBody,
  resolveLiveChatProfile,
} from './liveChatModel.js';

test('normalizeLiveChatBody should trim repeated whitespace', () => {
  assert.equal(normalizeLiveChatBody('  hello   world  '), 'hello world');
});

test('buildLiveChatPreview should clamp long bodies', () => {
  const preview = buildLiveChatPreview('x'.repeat(120));
  assert.equal(preview.endsWith('…'), true);
  assert.equal(preview.length <= 90, true);
});

test('resolveLiveChatProfile should prefer profile data over auth fallbacks', () => {
  assert.deepEqual(
    resolveLiveChatProfile({
      user: { email: 'user@example.com' },
      profile: { fullName: 'Test User', phone: '0790000000' },
    }),
    {
      customerName: 'Test User',
      customerEmail: 'user@example.com',
      customerPhone: '0790000000',
    }
  );
});

test('buildLiveChatConversationPayload should create an open conversation payload', () => {
  const payload = buildLiveChatConversationPayload({
    user: { id: 'user-1', email: 'user@example.com' },
    profile: { fullName: 'Test User', phone: '0790000000' },
  });

  assert.equal(payload.user_id, 'user-1');
  assert.equal(payload.status, LIVE_CHAT_OPEN_STATUS);
  assert.equal(payload.customer_name, 'Test User');
});

test('buildLiveChatMessagePayload should reject empty bodies', () => {
  assert.throws(
    () =>
      buildLiveChatMessagePayload({
        conversationId: 'conv-1',
        senderUserId: 'user-1',
        senderRole: 'customer',
        senderName: 'User',
        body: '   ',
      }),
    /\[LCH-103\]/
  );
});

test('buildLiveChatConversationUpdate should create admin metadata updates', () => {
  const payload = buildLiveChatConversationUpdate({
    body: 'تم الرد على رسالتك',
    senderRole: 'admin',
  });

  assert.equal(payload.status, LIVE_CHAT_OPEN_STATUS);
  assert.equal(payload.last_message_sender_role, 'admin');
  assert.equal(payload.last_message_preview, 'تم الرد على رسالتك');
});
