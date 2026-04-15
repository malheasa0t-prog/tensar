import React from "react";
import { Link as RouterLink } from "react-router-dom";

function isExternalHref(href) {
  const value = String(href || "");
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:") ||
    value.startsWith("#")
  );
}

const NextLink = React.forwardRef(function NextLink(
  { href = "/", children, prefetch, replace, scroll, ...props },
  ref
) {
  void prefetch;
  void scroll;

  if (typeof href !== "string" || isExternalHref(href)) {
    return (
      <a ref={ref} href={href} {...props}>
        {children}
      </a>
    );
  }

  return (
    <RouterLink ref={ref} to={href} replace={replace} {...props}>
      {children}
    </RouterLink>
  );
});

export default NextLink;
