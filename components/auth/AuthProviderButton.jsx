import styles from "./AuthAccessShell.module.css";

/**
 * Renders one social auth provider button with a branded icon.
 *
 * @param {{
 *   disabled?: boolean,
 *   isLoading?: boolean,
 *   label: string,
 *   onClick: () => void,
 *   provider: string,
 * }} props
 * @returns {import("react").JSX.Element}
 */
export default function AuthProviderButton({
  disabled = false,
  isLoading = false,
  label,
  onClick,
  provider,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={styles.providerButton}
      aria-label={label}
    >
      {isLoading ? <span className={`btn-spinner ${styles.providerSpinner}`} aria-hidden="true" /> : null}
      {!isLoading ? <span className={styles.providerIcon}>{getProviderIcon(provider)}</span> : null}
      <span>{isLoading ? "جارٍ التحويل..." : label}</span>
    </button>
  );
}

/**
 * Returns the SVG icon for one supported auth provider.
 *
 * @param {string} provider
 * @returns {import("react").JSX.Element}
 */
function getProviderIcon(provider) {
  const key = String(provider || "").trim().toLowerCase();

  if (key === "facebook") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M13.5 22v-8h2.7l.5-3.2h-3.2V8.9c0-.9.3-1.6 1.7-1.6h1.8V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.4v2.1H8v3.2h2.9v8h2.6Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (key === "apple") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M15.23 1c.14 1.56-.45 2.73-1.16 3.55-.76.84-1.97 1.49-3.16 1.4-.16-1.49.48-2.62 1.18-3.38C12.87 1.73 14.12 1.06 15.23 1Zm4.24 15.38c-.51 1.17-.76 1.69-1.41 2.69-.91 1.4-2.19 3.14-3.79 3.16-1.42.02-1.79-.93-3.72-.92-1.93.01-2.34.94-3.76.92-1.6-.02-2.81-1.58-3.72-2.98-2.56-3.95-2.83-8.58-1.25-10.99 1.12-1.71 2.89-2.72 4.56-2.72 1.7 0 2.77.94 4.18.94 1.36 0 2.19-.94 4.17-.94 1.49 0 3.07.81 4.19 2.2-3.66 2-3.07 7.23.55 8.64Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
