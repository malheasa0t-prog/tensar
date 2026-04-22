/**
 * Shared helpers for the live chat flows used by the storefront and admin UI.
 */

export const LIVE_CHAT_SUBJECT = 'محادثة مباشرة';
export const LIVE_CHAT_OPEN_STATUS = 'open';
export const LIVE_CHAT_MESSAGE_MAX_LENGTH = 1000;
export const LIVE_CHAT_PREVIEW_MAX_LENGTH = 90;
export const LIVE_CHAT_ERROR_MESSAGES = Object.freeze({
  conversationId: '[LCH-101] معرّف المحادثة غير متاح.',
  senderUserId: '[LCH-102] معرّف المرسل غير متاح.',
  emptyBody: '[LCH-103] اكتب رسالتك أولاً.',
  longBody: '[LCH-104] الرسالة طويلة جداً.',
});

/**
 * Normalizes a free-form chat body before sending it.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeLiveChatBody(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

/**
 * Builds a short preview used in the conversation list.
 *
 * @param {unknown} body
 * @returns {string}
 */
export function buildLiveChatPreview(body) {
  const normalizedBody = normalizeLiveChatBody(body);

  if (normalizedBody.length <= LIVE_CHAT_PREVIEW_MAX_LENGTH) {
    return normalizedBody;
  }

  return `${normalizedBody.slice(0, LIVE_CHAT_PREVIEW_MAX_LENGTH - 1)}…`;
}

/**
 * Resolves the best customer profile snapshot for live chat.
 *
 * @param {{ user?: Record<string, unknown> | null, profile?: Record<string, unknown> | null }} input
 * @returns {{ customerName: string, customerEmail: string, customerPhone: string }}
 */
export function resolveLiveChatProfile({ user, profile }) {
  const userEmail = String(user?.email || '').trim();
  const fallbackName = userEmail ? userEmail.split('@')[0] : 'عميل الموقع';
  const customerName = String(profile?.fullName || profile?.full_name || fallbackName).trim() || fallbackName;

  return {
    customerName,
    customerEmail: String(profile?.email || userEmail).trim(),
    customerPhone: String(profile?.phone || '').trim(),
  };
}

/**
 * Creates the conversation payload used when a customer opens a new chat.
 *
 * @param {{ user: Record<string, unknown>, profile?: Record<string, unknown> | null }} input
 * @returns {Record<string, unknown>}
 */
export function buildLiveChatConversationPayload({ user, profile }) {
  const resolvedProfile = resolveLiveChatProfile({ user, profile });

  return {
    user_id: user.id,
    subject: LIVE_CHAT_SUBJECT,
    status: LIVE_CHAT_OPEN_STATUS,
    customer_name: resolvedProfile.customerName,
    customer_email: resolvedProfile.customerEmail || null,
    customer_phone: resolvedProfile.customerPhone || null,
    last_message_preview: '',
    last_message_sender_role: 'customer',
    last_message_at: new Date().toISOString(),
  };
}

/**
 * Creates the row payload inserted into the chat messages table.
 *
 * @param {{ conversationId: string, senderUserId: string, senderRole: string, senderName: string, body: unknown }} input
 * @returns {Record<string, unknown>}
 * @throws {Error}
 */
export function buildLiveChatMessagePayload({ conversationId, senderUserId, senderRole, senderName, body }) {
  const normalizedBody = normalizeLiveChatBody(body);

  if (!conversationId) {
    throw new Error(LIVE_CHAT_ERROR_MESSAGES.conversationId);
  }
  if (!senderUserId) {
    throw new Error(LIVE_CHAT_ERROR_MESSAGES.senderUserId);
  }
  if (!normalizedBody) {
    throw new Error(LIVE_CHAT_ERROR_MESSAGES.emptyBody);
  }
  if (normalizedBody.length > LIVE_CHAT_MESSAGE_MAX_LENGTH) {
    throw new Error(LIVE_CHAT_ERROR_MESSAGES.longBody);
  }

  return {
    conversation_id: conversationId,
    sender_user_id: senderUserId,
    sender_role: senderRole === 'admin' ? 'admin' : 'customer',
    sender_name: String(senderName || 'زائر').trim() || 'زائر',
    body: normalizedBody,
    is_read_by_customer: senderRole === 'customer',
    is_read_by_admin: senderRole === 'admin',
  };
}

/**
 * Creates the metadata update applied to the conversation after each message.
 *
 * @param {{ body: unknown, senderRole: string, status?: string }} input
 * @returns {Record<string, unknown>}
 */
export function buildLiveChatConversationUpdate({ body, senderRole, status = LIVE_CHAT_OPEN_STATUS }) {
  return {
    status,
    last_message_preview: buildLiveChatPreview(body),
    last_message_sender_role: senderRole === 'admin' ? 'admin' : 'customer',
    last_message_at: new Date().toISOString(),
  };
}
