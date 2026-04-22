/**
 * Global Error Boundary — catches unhandled React errors.
 *
 * Displays a polished Arabic error page with a retry button
 * instead of a blank white screen when a component crashes.
 *
 * @module components/ErrorBoundary
 */

import { Component } from 'react';
import styles from './ErrorBoundary.module.css';

const FALLBACK_ERROR_CODE = 'APP-501';
const ERROR_CODE_PATTERN = /\[([A-Z]{2,4}-\d{3})\]/;

function resolveBoundaryErrorCode(error) {
  const match = String(error?.message || '').match(ERROR_CODE_PATTERN);
  return match ? match[1] : FALLBACK_ERROR_CODE;
}

/* ─── Constants ─── */

const ERROR_TITLE = 'عذراً، حدث خطأ غير متوقع';
const ERROR_SUBTITLE = 'لا تقلق — فريقنا يعمل على حل المشكلة. يمكنك المحاولة مرة أخرى.';
const RETRY_LABEL = 'حاول مرة أخرى';
const HOME_LABEL = 'العودة للرئيسية';

/**
 * React Error Boundary — class component required by React API.
 *
 * Wraps the entire application to catch unhandled rendering errors
 * and display a user-friendly fallback UI.
 *
 * @extends {Component<{children: React.ReactNode, resetKey?: string}, {hasError: boolean, error: Error|null}>}
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * Derives state from caught errors.
   *
   * @param {Error} error - The caught error.
   * @returns {{ hasError: boolean, error: Error }}
   */
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  /**
   * Logs the error for debugging/monitoring.
   *
   * @param {Error} error
   * @param {{ componentStack: string }} errorInfo
   */
  componentDidCatch(error, errorInfo) {
    if (typeof window !== 'undefined' && window.console) {
      console.error('[APP-501] React render boundary captured an unhandled exception:', error, errorInfo.componentStack);
    }
  }

  /**
   * Clears the active error when the route key changes.
   *
   * @param {{ children: React.ReactNode, resetKey?: string }} prevProps
   */
  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  /**
   * Resets the error state to retry rendering.
   */
  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  /**
   * Navigates to the home page and resets state.
   */
  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className={styles.backdrop}>
        <div className={styles.card}>
          {/* Animated icon */}
          <div className={styles.iconWrap}>
            <svg
              className={styles.icon}
              viewBox="0 0 120 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="60" cy="60" r="56" stroke="currentColor" strokeWidth="3" opacity="0.15" />
              <circle cx="60" cy="60" r="44" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
              <path
                d="M60 35v30"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                className={styles.exclamLine}
              />
              <circle cx="60" cy="80" r="3" fill="currentColor" className={styles.exclamDot} />
            </svg>
          </div>

          {/* Text content */}
          <h1 className={styles.title}>{ERROR_TITLE}</h1>
          <p className={styles.subtitle}>{ERROR_SUBTITLE}</p>

          {/* Error code (non-sensitive) */}
          <div className={styles.errorCode}>
            <span>رمز الخطأ:</span>
            <code>{resolveBoundaryErrorCode(this.state.error)}</code>
          </div>

          {/* Action buttons */}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.retryBtn}
              onClick={this.handleRetry}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              {RETRY_LABEL}
            </button>

            <button
              type="button"
              className={styles.homeBtn}
              onClick={this.handleGoHome}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              {HOME_LABEL}
            </button>
          </div>
        </div>

        {/* Decorative background orbs */}
        <div className={styles.orb1} />
        <div className={styles.orb2} />
        <div className={styles.orb3} />
      </div>
    );
  }
}
