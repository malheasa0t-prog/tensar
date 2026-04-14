"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AppIcon from "./AppIcon";
import styles from "./ToastProvider.module.css";
import { normalizeToastPayload } from "@/lib/toastModel";

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismissToast = useCallback((toastId) => {
    const activeTimer = timersRef.current.get(toastId);

    if (activeTimer) {
      window.clearTimeout(activeTimer);
      timersRef.current.delete(toastId);
    }

    setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
  }, []);

  const showToast = useCallback((message, options) => {
    const payload = normalizeToastPayload(message, options);

    if (!payload.message) {
      return;
    }

    const id = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : String(Date.now());
    setToasts((prev) => [...prev, { id, ...payload }]);

    const timeoutId = window.setTimeout(() => {
      dismissToast(id);
    }, payload.duration);

    timersRef.current.set(id, timeoutId);
    return id;
  }, [dismissToast]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ dismissToast, showToast }}>
      {children}
      <div className={styles.container} aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <article
            key={toast.id}
            className={`${styles.toast} ${styles[`toast${toast.type[0].toUpperCase()}${toast.type.slice(1)}`]}`}
            style={{ "--toast-duration": `${toast.duration}ms` }}
          >
            <div className={styles.iconWrap}>
              <AppIcon name={toast.icon} size={18} />
            </div>

            <div className={styles.copy}>
              <strong>{toast.title}</strong>
              <p>{toast.message}</p>
            </div>

            <button
              type="button"
              className={styles.closeButton}
              onClick={() => dismissToast(toast.id)}
              aria-label="إغلاق الإشعار"
            >
              <AppIcon name="x" size={15} />
            </button>

            <span className={styles.progress} aria-hidden="true" />
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
