import { supabase } from '../lib/supabaseClient.js';
import {
  LIVE_CHAT_OPEN_STATUS,
  LIVE_CHAT_ERROR_MESSAGES,
  buildLiveChatConversationPayload,
  buildLiveChatConversationUpdate,
  buildLiveChatMessagePayload,
  resolveLiveChatProfile,
} from '../lib/liveChatModel.js';

const LIVE_CHAT_SNAPSHOT_ERROR = '[LCH-301] تعذر تحميل المحادثة الحالية.';
const LIVE_CHAT_MESSAGES_ERROR = '[LCH-302] تعذر تحميل الرسائل حالياً.';
const LIVE_CHAT_LOGIN_REQUIRED_ERROR = '[LCH-201] سجل الدخول أولاً لبدء المحادثة.';
const LIVE_CHAT_OPEN_ERROR = '[LCH-303] تعذر فتح المحادثة المباشرة حالياً.';
const LIVE_CHAT_SEND_ERROR = '[LCH-304] تعذر إرسال الرسالة حالياً.';
const LIVE_CHAT_REFRESH_ERROR = '[LCH-305] تم إرسال الرسالة لكن تعذر تحديث المحادثة.';
const LIVE_CHAT_READ_SYNC_ERROR = '[LCH-306] تعذر تحديث حالة الردود الجديدة.';

/**
 * Loads the authenticated user and the best matching profile data for live chat.
 *
 * @param {typeof supabase} [client=supabase]
 * @returns {Promise<{ user: Record<string, unknown> | null, profile: Record<string, unknown> | null, error: string }>}
 */
export async function getLiveChatAuthSnapshot(client = supabase) {
  const authResponse = await client.auth.getUser();
  const user = authResponse?.data?.user || null;

  if (!user) {
    return { user: null, profile: null, error: '' };
  }

  const [profileResponse, legacyResponse] = await Promise.all([
    client.from('user_profiles').select('full_name, phone').eq('user_id', user.id).maybeSingle(),
    client.from('app_users').select('full_name, phone, email').eq('auth_user_id', user.id).maybeSingle(),
  ]);

  return {
    user,
    profile: {
      fullName: profileResponse?.data?.full_name || legacyResponse?.data?.full_name || '',
      phone: profileResponse?.data?.phone || legacyResponse?.data?.phone || '',
      email: legacyResponse?.data?.email || user.email || '',
    },
    error: '',
  };
}

/**
 * Fetches the latest customer conversation.
 *
 * @param {string} userId
 * @param {typeof supabase} [client=supabase]
 * @returns {Promise<{ conversation: Record<string, unknown> | null, error: string }>}
 */
export async function fetchLatestCustomerConversation(userId, client = supabase) {
  if (!userId) {
    return { conversation: null, error: '' };
  }

  const response = await client
    .from('support_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    conversation: response.data || null,
    error: response.error ? LIVE_CHAT_SNAPSHOT_ERROR : '',
  };
}

/**
 * Fetches all messages for a conversation in chronological order.
 *
 * @param {string} conversationId
 * @param {typeof supabase} [client=supabase]
 * @returns {Promise<{ messages: Array<Record<string, unknown>>, error: string }>}
 */
export async function fetchConversationMessages(conversationId, client = supabase) {
  if (!conversationId) {
    return { messages: [], error: '' };
  }

  const response = await client
    .from('support_chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  return {
    messages: response.data || [],
    error: response.error ? LIVE_CHAT_MESSAGES_ERROR : '',
  };
}

/**
 * Ensures the customer has an open conversation ready for the next message.
 *
 * @param {{ user: Record<string, unknown>, profile?: Record<string, unknown> | null }} input
 * @param {typeof supabase} [client=supabase]
 * @returns {Promise<{ conversation: Record<string, unknown> | null, error: string }>}
 */
export async function ensureCustomerConversation(input, client = supabase) {
  const userId = String(input?.user?.id || '').trim();

  if (!userId) {
    return { conversation: null, error: LIVE_CHAT_LOGIN_REQUIRED_ERROR };
  }

  const existingResponse = await client
    .from('support_conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('status', LIVE_CHAT_OPEN_STATUS)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingResponse.data) {
    return { conversation: existingResponse.data, error: '' };
  }

  const payload = buildLiveChatConversationPayload(input);
  const createResponse = await client
    .from('support_conversations')
    .insert([payload])
    .select('*')
    .single();

  return {
    conversation: createResponse.data || null,
    error: createResponse.error ? LIVE_CHAT_OPEN_ERROR : '',
  };
}

/**
 * Inserts a customer message and refreshes the conversation metadata.
 *
 * @param {{ user: Record<string, unknown>, profile?: Record<string, unknown> | null, conversation?: Record<string, unknown> | null, body: unknown }} input
 * @param {typeof supabase} [client=supabase]
 * @returns {Promise<{ conversation: Record<string, unknown> | null, message: Record<string, unknown> | null, error: string }>}
 */
export async function sendCustomerChatMessage(input, client = supabase) {
  const user = input?.user || null;
  const profile = resolveLiveChatProfile({ user, profile: input?.profile });
  const conversationState = input?.conversation;
  const hasOpenConversation = conversationState?.id && conversationState?.status === LIVE_CHAT_OPEN_STATUS;
  const ensuredConversation = hasOpenConversation
    ? { conversation: conversationState, error: '' }
    : await ensureCustomerConversation({ user, profile }, client);

  if (ensuredConversation.error || !ensuredConversation.conversation) {
    return { conversation: null, message: null, error: ensuredConversation.error || LIVE_CHAT_OPEN_ERROR };
  }

  let messagePayload;
  try {
    messagePayload = buildLiveChatMessagePayload({
      conversationId: ensuredConversation.conversation.id,
      senderUserId: user.id,
      senderRole: 'customer',
      senderName: profile.customerName,
      body: input?.body,
    });
  } catch (error) {
    return {
      conversation: ensuredConversation.conversation,
      message: null,
      error: error?.message || LIVE_CHAT_ERROR_MESSAGES.emptyBody,
    };
  }

  const insertResponse = await client
    .from('support_chat_messages')
    .insert([messagePayload])
    .select('*')
    .single();

  if (insertResponse.error) {
    return { conversation: ensuredConversation.conversation, message: null, error: LIVE_CHAT_SEND_ERROR };
  }

  const updateResponse = await client
    .from('support_conversations')
    .update(buildLiveChatConversationUpdate({ body: input?.body, senderRole: 'customer' }))
    .eq('id', ensuredConversation.conversation.id)
    .select('*')
    .single();

  return {
    conversation: updateResponse.data || ensuredConversation.conversation,
    message: insertResponse.data || null,
    error: updateResponse.error ? LIVE_CHAT_REFRESH_ERROR : '',
  };
}

/**
 * Marks unseen admin replies as read for the customer.
 *
 * @param {string} conversationId
 * @param {typeof supabase} [client=supabase]
 * @returns {Promise<string>}
 */
export async function markAdminRepliesAsRead(conversationId, client = supabase) {
  if (!conversationId) {
    return '';
  }

  const response = await client
    .from('support_chat_messages')
    .update({ is_read_by_customer: true })
    .eq('conversation_id', conversationId)
    .eq('sender_role', 'admin')
    .eq('is_read_by_customer', false);

  return response.error ? LIVE_CHAT_READ_SYNC_ERROR : '';
}

/**
 * Subscribes to conversation changes for the authenticated customer.
 *
 * @param {string} userId
 * @param {() => void} onChange
 * @param {typeof supabase} [client=supabase]
 * @returns {() => void}
 */
export function subscribeToCustomerConversations(userId, onChange, client = supabase) {
  if (!userId || typeof onChange !== 'function') {
    return () => {};
  }

  const channel = client
    .channel(`live-chat-conversations-${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'support_conversations',
      filter: `user_id=eq.${userId}`,
    }, onChange)
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

/**
 * Subscribes to message changes for a single conversation.
 *
 * @param {string} conversationId
 * @param {() => void} onChange
 * @param {typeof supabase} [client=supabase]
 * @returns {() => void}
 */
export function subscribeToConversationMessages(conversationId, onChange, client = supabase) {
  if (!conversationId || typeof onChange !== 'function') {
    return () => {};
  }

  const channel = client
    .channel(`live-chat-messages-${conversationId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'support_chat_messages',
      filter: `conversation_id=eq.${conversationId}`,
    }, onChange)
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
