/**
 * TechZone AI Chatbot - Chat Widget Component
 *
 * هذا المكوّن هو "الواجهة" التي يراها العميل.
 * فقاعة شات تظهر في أسفل الصفحة، يمكن فتحها وإغلاقها.
 *
 * --- كيف يعمل؟ ---
 * 1. العميل يضغط على أيقونة الشات ← تفتح نافذة المحادثة
 * 2. يكتب سؤال ويضغط إرسال
 * 3. الرسالة تُرسل إلى /api/chat (الـ API Route)
 * 4. يظهر رد البوت في المحادثة
 * 5. تاريخ المحادثة يُحفظ في الـ state ويُرسل مع كل رسالة جديدة
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { loadSupabaseClient } from '../lib/loadSupabaseClient';
import styles from './AiChatbot.module.css';

/* ─────────────── الإعدادات الثابتة ─────────────── */

/** رسالة الترحيب الأولية */
const WELCOME_MESSAGE = {
  role: 'assistant',
  content: 'مرحباً! 👋 أنا تيك، مساعدك الذكي في TechZone.\nكيف يمكنني مساعدتك اليوم؟',
};

/** أسئلة سريعة جاهزة يضغط عليها العميل */
const QUICK_QUESTIONS = [
  'ما المنتجات المتوفرة؟',
  'أريد صيانة جهازي',
  'ما طرق الدفع؟',
  'كيف أتواصل معكم؟',
];

/** الحد الأقصى لطول الرسالة */
const MAX_MESSAGE_LENGTH = 500;

/* ─────────────── المكوّن الرئيسي ─────────────── */

/**
 * مكوّن الشات بوت الذكي.
 * يُعرض كفقاعة عائمة في أسفل يسار الصفحة.
 *
 * @returns {JSX.Element}
 */
export default function AiChatbot() {
  // ── الحالة (State) ──
  const [isOpen, setIsOpen] = useState(false);        // هل نافذة الشات مفتوحة؟
  const [messages, setMessages] = useState([WELCOME_MESSAGE]); // قائمة الرسائل
  const [inputValue, setInputValue] = useState('');    // نص حقل الإدخال
  const [isLoading, setIsLoading] = useState(false);   // هل ينتظر رد من API؟

  // ── المراجع (Refs) ──
  const messagesEndRef = useRef(null);  // للتمرير التلقائي لآخر رسالة
  const inputRef = useRef(null);        // للتركيز على حقل الإدخال

  // ── التمرير التلقائي عند إضافة رسالة جديدة ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── التركيز على حقل الإدخال عند فتح الشات ──
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      void loadSupabaseClient();
    }
  }, [isOpen]);

  /**
   * يُرسل رسالة إلى الـ API ويعرض الرد.
   *
   * @param {string} messageText - نص الرسالة
   */
  const sendMessage = useCallback(async (messageText) => {
    const trimmed = messageText.trim();
    if (!trimmed || isLoading) return;

    // إضافة رسالة العميل إلى المحادثة
    const userMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // تجهيز تاريخ المحادثة (بدون رسالة الترحيب)
      const history = messages
        .filter((msg) => msg !== WELCOME_MESSAGE)
        .map((msg) => ({ role: msg.role, content: msg.content }));

      // الحصول على توكن المصادقة
      const supabase = await loadSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: 'يجب تسجيل الدخول أولاً لاستخدام المحادثة الذكية. 🔐',
        }]);
        return;
      }

      // إرسال الطلب إلى API Route مع التوكن
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: trimmed,
          history,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'فشل الاتصال بالخادم');
      }

      // إضافة رد البوت إلى المحادثة
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      // في حالة خطأ، نعرض رسالة خطأ للعميل
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'عذراً، حدث خطأ. حاول مرة أخرى. 🔄' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages]);

  /**
   * يعالج ضغط Enter لإرسال الرسالة.
   *
   * @param {React.KeyboardEvent} event
   */
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage(inputValue);
    }
  }, [inputValue, sendMessage]);

  /**
   * يعالج الضغط على سؤال سريع.
   *
   * @param {string} question
   */
  const handleQuickQuestion = useCallback((question) => {
    sendMessage(question);
  }, [sendMessage]);

  // ── العرض (Render) ──
  return (
    <>
      {/* ══════ زر فتح/إغلاق الشات ══════ */}
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

      {/* ══════ نافذة المحادثة ══════ */}
      {isOpen && (
        <div className={styles.chatWindow}>
          {/* ── الهيدر ── */}
          <div className={styles.chatHeader}>
            <div className={styles.chatHeaderInfo}>
              <div className={styles.chatAvatar}>🤖</div>
              <div>
                <h3 className={styles.chatTitle}>تيك — المساعد الذكي</h3>
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
              ✕
            </button>
          </div>

          {/* ── منطقة الرسائل ── */}
          <div className={styles.chatMessages}>
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`${styles.messageBubble} ${
                  msg.role === 'user' ? styles.userMessage : styles.botMessage
                }`}
              >
                {msg.role === 'assistant' && (
                  <span className={styles.messageAvatar}>🤖</span>
                )}
                <div className={styles.messageContent}>
                  {msg.content.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </div>
            ))}

            {/* مؤشر الكتابة أثناء انتظار الرد */}
            {isLoading && (
              <div className={`${styles.messageBubble} ${styles.botMessage}`}>
                <span className={styles.messageAvatar}>🤖</span>
                <div className={styles.typingIndicator}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── أسئلة سريعة (تظهر فقط في البداية) ── */}
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

          {/* ── حقل الإدخال ── */}
          <div className={styles.chatInputArea}>
            <input
              ref={inputRef}
              type="text"
              className={styles.chatInput}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
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

          {/* ── فوتر ── */}
          <div className={styles.chatFooter}>
            مدعوم بالذكاء الاصطناعي — Groq AI
          </div>
        </div>
      )}
    </>
  );
}
