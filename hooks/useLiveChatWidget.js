"use client";

import { useEffect, useState } from "react";
import {
  fetchConversationMessages,
  fetchLatestCustomerConversation,
  getLiveChatAuthSnapshot,
  markAdminRepliesAsRead,
  sendCustomerChatMessage,
  subscribeToConversationMessages,
  subscribeToCustomerConversations,
} from "@/services/liveChatService";

/**
 * Manages the storefront live chat widget state, loading, and realtime updates.
 *
 * @param {{ isOpen: boolean }} params
 * @returns {{
 *   user: Record<string, unknown> | null,
 *   profile: Record<string, unknown> | null,
 *   authLoading: boolean,
 *   loading: boolean,
 *   sending: boolean,
 *   error: string,
 *   conversation: Record<string, unknown> | null,
 *   messages: Array<Record<string, unknown>>,
 *   draft: string,
 *   setDraft: (value: string) => void,
 *   sendDraft: () => Promise<string>
 * }}
 */
export function useLiveChatWidget({ isOpen }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    let active = true;
    let cleanupConversation = () => {};
    let cleanupMessages = () => {};

    /**
     * Loads the currently selected conversation messages.
     *
     * @param {string} conversationId
     * @returns {Promise<void>}
     */
    async function loadMessages(conversationId) {
      const snapshot = await fetchConversationMessages(conversationId);

      if (!active) {
        return;
      }

      setMessages(snapshot.messages);
      if (snapshot.error) {
        setError(snapshot.error);
        return;
      }

      setError("");
      void markAdminRepliesAsRead(conversationId);
    }

    /**
     * Loads the latest conversation shell for the current user.
     *
     * @param {string} userId
     * @returns {Promise<void>}
     */
    async function loadConversation(userId) {
      const snapshot = await fetchLatestCustomerConversation(userId);

      if (!active) {
        return;
      }

      setConversation(snapshot.conversation);
      if (snapshot.error) {
        setMessages([]);
        setError(snapshot.error);
        return;
      }

      if (!snapshot.conversation?.id) {
        setMessages([]);
        setError("");
        cleanupMessages();
        cleanupMessages = () => {};
        return;
      }

      await loadMessages(snapshot.conversation.id);
      cleanupMessages();
      cleanupMessages = subscribeToConversationMessages(snapshot.conversation.id, () => {
        void loadMessages(snapshot.conversation.id);
      });
    }

    /**
     * Hydrates the auth and conversation snapshot when the widget opens.
     *
     * @returns {Promise<void>}
     */
    async function hydrateWidget() {
      setAuthLoading(true);
      setLoading(true);

      const authSnapshot = await getLiveChatAuthSnapshot();

      if (!active) {
        return;
      }

      setUser(authSnapshot.user);
      setProfile(authSnapshot.profile);
      setAuthLoading(false);

      if (!authSnapshot.user) {
        setConversation(null);
        setMessages([]);
        setLoading(false);
        setError("");
        return;
      }

      await loadConversation(authSnapshot.user.id);
      cleanupConversation = subscribeToCustomerConversations(authSnapshot.user.id, () => {
        void loadConversation(authSnapshot.user.id);
      });
      setLoading(false);
    }

    void hydrateWidget();

    return () => {
      active = false;
      cleanupConversation();
      cleanupMessages();
    };
  }, [isOpen]);

  /**
   * Sends the current draft and refreshes the local chat state.
   *
   * @returns {Promise<string>}
   */
  async function sendDraft() {
    if (!user) {
      return "[LCH-201] سجل الدخول أولاً لبدء المحادثة المباشرة.";
    }

    setSending(true);
    setError("");

    const response = await sendCustomerChatMessage({
      user,
      profile,
      conversation,
      body: draft,
    });

    setSending(false);
    if (response.message) {
      setDraft("");
      setConversation(response.conversation);
      setMessages((prev) => [...prev, response.message]);
    }

    if (response.error) {
      setError(response.error);
      return response.error;
    }

    return "";
  }

  return {
    user,
    profile,
    authLoading,
    loading,
    sending,
    error,
    conversation,
    messages,
    draft,
    setDraft,
    sendDraft,
  };
}
