"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppIcon from "@/components/AppIcon";
import { useToast } from "@/components/ToastProvider";
import { useLiveChatWidget } from "@/hooks/useLiveChatWidget";
import styles from "@/components/LiveChatWidget.module.css";

/**
 * Formats a chat message timestamp using the Arabic locale.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
function formatChatTime(value) {
  if (!value) {
    return "الآن";
  }

  return new Date(value).toLocaleTimeString("ar-JO", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Floating live chat widget for signed-in storefront customers.
 *
 * @returns {JSX.Element | null}
 */
export default function LiveChatWidget() {
  const pathname = usePathname();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const threadRef = useRef(null);
  const {
    user,
    authLoading,
    loading,
    sending,
    error,
    conversation,
    messages,
    draft,
    setDraft,
    sendDraft,
  } = useLiveChatWidget({ isOpen });

  useEffect(() => {
    if (!isOpen || !threadRef.current) {
      return;
    }

    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [isOpen, messages]);

  if (pathname?.startsWith("/auth") || pathname?.startsWith("/admin")) {
    return null;
  }

  /**
   * Sends the current message draft and reports any resulting error.
   *
   * @param {React.FormEvent<HTMLFormElement>} event
   * @returns {Promise<void>}
   */
  async function handleSubmit(event) {
    event.preventDefault();
    const nextError = await sendDraft();

    if (nextError) {
      showToast(nextError);
      return;
    }

    showToast("تم إرسال رسالتك إلى فريق الدعم.");
  }

  return (
    <div className={styles.shell}>
      {isOpen ? (
        <section className={styles.panel} aria-label="الدردشة المباشرة">
          <header className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <h3>
                <AppIcon name="message" size={18} />
                الدردشة المباشرة
              </h3>
              <p>ابدأ محادثة فورية مع فريق TECHZONE من أي صفحة داخل الموقع.</p>
            </div>

            <button
              type="button"
              className={styles.closeButton}
              onClick={() => setIsOpen(false)}
              aria-label="إغلاق الدردشة"
            >
              <AppIcon name="x" size={16} />
            </button>
          </header>

          <div className={styles.panelStatus}>
            <div>
              <h4>{conversation?.subject || "محادثة الدعم"}</h4>
              <p>{user ? "الحساب الحالي جاهز لاستقبال الردود المباشرة." : "سجّل الدخول لبدء المحادثة."}</p>
            </div>
            <span className={styles.statusBadge}>
              <AppIcon name="shield" size={14} />
              {conversation?.status === "closed" ? "مغلقة" : "متاح الآن"}
            </span>
          </div>

          {!authLoading && !user ? (
            <div className={styles.signinPrompt}>
              <AppIcon name="lock" size={34} />
              <h4>الدردشة المباشرة تحتاج حساباً مسجلاً</h4>
              <p>سجل الدخول أولاً ليتم حفظ المحادثة داخل حسابك وتستقبل الردود والإشعارات مباشرة.</p>
              <Link href="/auth/login" className={styles.signinButton}>
                <AppIcon name="lock" size={15} />
                تسجيل الدخول
              </Link>
            </div>
          ) : loading || authLoading ? (
            <div className={styles.emptyState}>
              <AppIcon name="refresh" size={30} />
              <h4>جاري تحميل المحادثة</h4>
              <p>نجهز لك سجل الرسائل الحالي والاتصال المباشر مع فريق الدعم.</p>
            </div>
          ) : (
            <>
              <div className={styles.thread} ref={threadRef}>
                {messages.length > 0 ? (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`${styles.messageRow} ${
                        message.sender_role === "admin" ? styles.messageAdmin : styles.messageCustomer
                      }`}
                    >
                      <div className={styles.messageBubble}>
                        <div className={styles.messageMeta}>
                          <strong>{message.sender_name}</strong>
                          <p>{formatChatTime(message.created_at)}</p>
                        </div>
                        <div className={styles.messageBody}>{message.body}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <AppIcon name="message" size={30} />
                    <h4>ابدأ المحادثة الآن</h4>
                    <p>اكتب أول رسالة وسيتابعها فريق TECHZONE مباشرة من لوحة الأدمن.</p>
                  </div>
                )}
              </div>

              <footer className={styles.panelFooter}>
                {error ? <div className={styles.notice}>{error}</div> : null}

                <form className={styles.composer} onSubmit={handleSubmit}>
                  <textarea
                    name="message"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="اكتب رسالتك هنا..."
                    disabled={sending || !user}
                  />

                  <div className={styles.composerActions}>
                    <p className={styles.composerHint}>
                      سيصلك الرد مباشرة داخل هذه المحادثة وفي مركز الإشعارات.
                    </p>

                    <button type="submit" className={styles.composerButton} disabled={sending || !user}>
                      <AppIcon name="send" size={15} />
                      {sending ? "جاري الإرسال..." : "إرسال"}
                    </button>
                  </div>
                </form>
              </footer>
            </>
          )}
        </section>
      ) : null}

      <button
        type="button"
        className={styles.toggleButton}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "إغلاق الدردشة المباشرة" : "فتح الدردشة المباشرة"}
      >
        <AppIcon name="message" size={24} />
      </button>

      <div className={styles.toggleNote}>دردشة مباشرة مع فريق TECHZONE</div>
    </div>
  );
}
