/**
 * Next.js Link compatibility shim for React Router DOM.
 */

import { forwardRef, useCallback, useEffect, useRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { prefetchRouteModule, shouldPrefetchRoute } from '../routePrefetch';

const ROUTE_PREFETCH_ROOT_MARGIN = '220px 0px';
const ROUTE_PREFETCH_IDLE_TIMEOUT_MS = 1200;
const ROUTE_PREFETCH_FALLBACK_DELAY_MS = 80;

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
 * Writes a DOM node into a forwarded React ref.
 *
 * @param {React.Ref<HTMLAnchorElement>} forwardedRef
 * @param {HTMLAnchorElement | null} node
 * @returns {void}
 */
function assignForwardedRef(forwardedRef, node) {
  if (typeof forwardedRef === 'function') {
    forwardedRef(node);
    return;
  }

  if (forwardedRef && typeof forwardedRef === 'object') {
    forwardedRef.current = node;
  }
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
    onMouseDown,
    onPointerDown,
    onTouchStart,
    onClick,
    scroll,
    ...rest
  },
  ref
) {
  const resolvedHref = resolveHrefValue(href);
  const linkElementRef = useRef(null);
  const canPrefetchRoute = Boolean(
    prefetch !== false &&
      resolvedHref &&
      !isPlainAnchorHref(resolvedHref) &&
      shouldPrefetchRoute(resolvedHref)
  );
  const anchorEvents = {
    onFocus,
    onMouseEnter,
    onMouseDown,
    onPointerDown,
    onTouchStart,
    onClick,
  };

  const setLinkElement = useCallback(
    /**
     * Stores the anchor node locally and forwards it to the caller.
     *
     * @param {HTMLAnchorElement | null} node
     * @returns {void}
     */
    (node) => {
      linkElementRef.current = node;
      assignForwardedRef(ref, node);
    },
    [ref]
  );

  useEffect(() => {
    if (!canPrefetchRoute || typeof window === 'undefined') {
      return undefined;
    }

    const linkElement = linkElementRef.current;

    if (!linkElement) {
      return undefined;
    }

    let cancelled = false;
    let idleCallbackId = 0;
    let timeoutId = 0;
    let observer = null;
    let prefetchScheduled = false;

    /**
     * Starts route prefetch once the browser is idle enough.
     *
     * @returns {void}
     */
    function schedulePrefetch() {
      if (prefetchScheduled) {
        return;
      }

      prefetchScheduled = true;

      /**
       * Loads the route module unless the link was unmounted.
       *
       * @returns {void}
       */
      function runPrefetch() {
        if (!cancelled) {
          void prefetchRouteModule(resolvedHref);
        }
      }

      if (typeof window.requestIdleCallback === 'function') {
        idleCallbackId = window.requestIdleCallback(runPrefetch, {
          timeout: ROUTE_PREFETCH_IDLE_TIMEOUT_MS,
        });
        return;
      }

      timeoutId = window.setTimeout(runPrefetch, ROUTE_PREFETCH_FALLBACK_DELAY_MS);
    }

    if (typeof window.IntersectionObserver === 'function') {
      observer = new window.IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) {
            observer?.disconnect();
            schedulePrefetch();
          }
        },
        { rootMargin: ROUTE_PREFETCH_ROOT_MARGIN }
      );
      observer.observe(linkElement);
    } else {
      schedulePrefetch();
    }

    return () => {
      cancelled = true;
      observer?.disconnect();

      if (idleCallbackId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleCallbackId);
      }

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [canPrefetchRoute, resolvedHref]);

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
      ref={setLinkElement}
      replace={replace}
      to={resolvedHref}
      onFocus={(event) => handleInteractivePrefetch(onFocus, event)}
      onMouseEnter={(event) => handleInteractivePrefetch(onMouseEnter, event)}
      onMouseDown={(event) => handleInteractivePrefetch(onMouseDown, event)}
      onPointerDown={(event) => handleInteractivePrefetch(onPointerDown, event)}
      onTouchStart={(event) => handleInteractivePrefetch(onTouchStart, event)}
      onClick={(event) => handleInteractivePrefetch(onClick, event)}
      {...rest}
    >
      {children}
    </RouterLink>
  );
});

Link.displayName = 'Link';

export default Link;
