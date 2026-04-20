/**
 * Next.js Link compatibility shim for React Router DOM.
 */

import { forwardRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { prefetchRouteModule, shouldPrefetchRoute } from '../routePrefetch';

/**
 * Resolves a Next.js-style href prop into a string path.
 *
 * @param {string | { hash?: string, pathname?: string, search?: string }} href
 * @returns {string}
 */
function resolveHrefValue(href) {
  if (typeof href === 'string') {
    return href;
  }

  if (!href || typeof href !== 'object') {
    return '';
  }

  return `${href.pathname || ''}${href.search || ''}${href.hash || ''}`;
}

/**
 * Checks whether a URL should stay on a plain anchor element.
 *
 * @param {string} href
 * @returns {boolean}
 */
function isPlainAnchorHref(href) {
  return Boolean(
    href &&
      (href.startsWith('http') ||
        href.startsWith('//') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.endsWith('.html') ||
        href.startsWith('#'))
  );
}

/**
 * Triggers a background module prefetch for internal routes.
 *
 * @param {boolean} prefetch
 * @param {string} href
 * @returns {void}
 */
function triggerRoutePrefetch(prefetch, href) {
  if (prefetch !== false && shouldPrefetchRoute(href)) {
    void prefetchRouteModule(href);
  }
}

/**
 * Maps Next.js Link props to React Router's Link component.
 *
 * @param {object} props
 * @param {string | { hash?: string, pathname?: string, search?: string }} props.href
 * @param {boolean} [props.prefetch]
 * @param {boolean} [props.replace]
 * @param {React.ReactNode} props.children
 * @param {React.Ref} ref
 * @returns {JSX.Element}
 */
const Link = forwardRef(function Link(
  {
    href,
    prefetch = true,
    replace,
    children,
    onFocus,
    onMouseEnter,
    onTouchStart,
    scroll,
    ...rest
  },
  ref
) {
  const resolvedHref = resolveHrefValue(href);
  const anchorEvents = {
    onFocus,
    onMouseEnter,
    onTouchStart,
  };

  if (!resolvedHref) {
    return <a ref={ref} {...anchorEvents} {...rest}>{children}</a>;
  }

  if (isPlainAnchorHref(resolvedHref)) {
    return <a ref={ref} href={resolvedHref} {...anchorEvents} {...rest}>{children}</a>;
  }

  /**
   * Calls the original event handler and prefetches the route module once.
   *
   * @param {(event: import('react').SyntheticEvent) => void} handler
   * @param {import('react').SyntheticEvent} event
   * @returns {void}
   */
  function handleInteractivePrefetch(handler, event) {
    handler?.(event);
    triggerRoutePrefetch(prefetch, resolvedHref);
  }

  return (
    <RouterLink
      ref={ref}
      replace={replace}
      to={resolvedHref}
      onFocus={(event) => handleInteractivePrefetch(onFocus, event)}
      onMouseEnter={(event) => handleInteractivePrefetch(onMouseEnter, event)}
      onTouchStart={(event) => handleInteractivePrefetch(onTouchStart, event)}
      {...rest}
    >
      {children}
    </RouterLink>
  );
});

Link.displayName = 'Link';

export default Link;
