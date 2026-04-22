/**
 * TechZone AI Chatbot widget.
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { loadSupabaseClient } from '../lib/loadSupabaseClient';
import styles from './AiChatbot.module.css';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: 'مرحباً! أنا تيك، مساعدك الذكي في TechZone.\nكيف يمكنني مساعدتك اليوم؟',
};
const QUICK_QUESTIONS = [
  'ما المنتجات المتوفرة؟',
  'أريد صيانة جهازي',
  'ما طرق الدفع؟',
  'كيف أتواصل معكم؟',
];
const MAX_MESSAGE_LENGTH = 500;
const CHAT_LOGIN_REQUIRED_MESSAGE = '[BOT-201] يجب تسجيل الدخول أولاً لاستخدام المحادثة الذكية.';
const CHAT_SERVER_ERROR_MESSAGE = '[BOT-401] فشل الاتصال بالخادم.';
const CHAT_UNEXPECTED_ERROR_MESSAGE = '[BOT-500] عذراً، حدث خطأ غير متوقع. حاول مرة أخرى.';

/**
 * Builds the fallback chatbot error message shown to customers.
 *
 * @param {unknown} error
 * @returns {string}
 */
function resolveChatbotErrorMessage(error) {
  return error instanceof Error && error.message ? error.message : CHAT_UNEXPECTED_ERROR_MESSAGE;
}

/**
 * Renders the floating chatbot widget.
 *
 * @returns {JSX.Element}
 */
export default function AiChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      void loadSupabaseClient();
    }
  }, [isOpen]);

  /**
   * Sends the customer message to the chat API and appends the reply.
   *
   * @param {string} messageText
   * @returns {Promise<void>}
   */
  const sendMessage = useCallback(async (messageText) => {
    const trimmed = messageText.trim();
    if (!trimmed || isLoading) return;

    const userMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const history = messages
        .filter((msg) => msg !== WELCOME_MESSAGE)
        .map((msg) => ({ role: msg.role, content: msg.content }));

      const supabase = await loadSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: CHAT_LOGIN_REQUIRED_MESSAGE },
        ]);
        return;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: trimmed,
          history,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || CHAT_SERVER_ERROR_MESSAGE);
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: resolveChatbotErrorMessage(error) },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages]);

  /**
   * Sends the message when the customer presses Enter without Shift.
   *
   * @param {React.KeyboardEvent} event
   * @returns {void}
   */
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage(inputValue);
    }
  }, [inputValue, sendMessage]);

  /**
   * Sends a pre-filled quick question.
   *
   * @param {string} question
   * @returns {void}
   */
  const handleQuickQuestion = useCallback((question) => {
    sendMessage(question);
  }, [sendMessage]);

  return (
    <>
      <button
        className={`${styles.chatToggle} ${isOpen ? styles.chatToggleOpen : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? 'إغلاق المحادثة' : 'فتح المحادثة الذكية'}
        title="المساعد الذكي"
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
        )}
        {!isOpen && <span className={styles.chatBadge}>AI</span>}
      </button>

      {isOpen && (
        <div className={styles.chatWindow}>
          <div className={styles.chatHeader}>
            <div className={styles.chatHeaderInfo}>
              <div className={styles.chatAvatar}>AI</div>
              <div>
                <h3 className={styles.chatTitle}>تيك - المساعد الذكي</h3>
                <span className={styles.chatStatus}>
                  <span className={styles.statusDot} /> متصل الآن
                </span>
              </div>
            </div>
            <button
              className={styles.chatClose}
              onClick={() => setIsOpen(false)}
              aria-label="إغلاق"
            >
              ×
            </button>
          </div>

          <div className={styles.chatMessages}>
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`${styles.messageBubble} ${
                  msg.role === 'user' ? styles.userMessage : styles.botMessage
                }`}
              >
                {msg.role === 'assistant' && (
                  <span className={styles.messageAvatar}>AI</span>
                )}
                <div className={styles.messageContent}>
                  {msg.content.split('\n').map((line, lineIndex) => (
                    <p key={lineIndex}>{line}</p>
                  ))}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className={`${styles.messageBubble} ${styles.botMessage}`}>
                <span className={styles.messageAvatar}>AI</span>
                <div className={styles.typingIndicator}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {messages.length <= 1 && (
            <div className={styles.quickQuestions}>
              {QUICK_QUESTIONS.map((question) => (
                <button
                  key={question}
                  className={styles.quickBtn}
                  onClick={() => handleQuickQuestion(question)}
                  disabled={isLoading}
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          <div className={styles.chatInputArea}>
            <input
              ref={inputRef}
              type="text"
              className={styles.chatInput}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              onKeyDown={handleKeyDown}
              placeholder="اكتب سؤالك هنا..."
              disabled={isLoading}
              maxLength={MAX_MESSAGE_LENGTH}
            />
            <button
              className={styles.sendBtn}
              onClick={() => sendMessage(inputValue)}
              disabled={isLoading || !inputValue.trim()}
              aria-label="إرسال"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>

          <div className={styles.chatFooter}>
            مدعوم بالذكاء الاصطناعي
          </div>
        </div>
      )}
    </>
  );
}
