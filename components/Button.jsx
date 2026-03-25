import Link from "next/link";

function joinClasses(...values) {
  return values.filter(Boolean).join(" ");
}

export default function Button({
  href,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = false,
  startIcon = null,
  endIcon = null,
  loadingLabel,
  className = "",
  children,
  onClick,
  type = "button",
  ...props
}) {
  const isUnavailable = disabled || loading;
  const classes = joinClasses(
    "btn",
    `btn-${variant}`,
    size !== "md" ? `btn-${size}` : "",
    fullWidth ? "btn-block" : "",
    loading ? "is-loading" : "",
    disabled ? "is-disabled" : "",
    className
  );

  const content = (
    <>
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : null}
      {!loading && startIcon ? <span className="btn-icon btn-icon-start">{startIcon}</span> : null}
      <span className="btn-label">{loading ? loadingLabel || children : children}</span>
      {!loading && endIcon ? <span className="btn-icon btn-icon-end">{endIcon}</span> : null}
    </>
  );

  if (href) {
    function handleLinkClick(event) {
      if (isUnavailable) {
        event.preventDefault();
        return;
      }

      if (typeof onClick === "function") {
        onClick(event);
      }
    }

    return (
      <Link
        href={href}
        className={classes}
        onClick={handleLinkClick}
        aria-disabled={isUnavailable || undefined}
        tabIndex={isUnavailable ? -1 : props.tabIndex}
        {...props}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={isUnavailable}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </button>
  );
}
