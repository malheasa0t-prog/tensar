/**
 * Pure helpers for smooth route transitions in the app shell.
 */

export const PAGE_TRANSITION_EXIT_MS = 0;
export const PAGE_TRANSITION_ENTER_MS = 120;

/**
 * Normalizes a pathname and search string into a stable route key.
 *
 * @param {{
 *   pathname?: string | null,
 *   search?: string | null,
 * }} input
 * @returns {string}
 */
export function buildRouteKey(input) {
  const pathname = typeof input?.pathname === "string" && input.pathname.trim() ? input.pathname.trim() : "/";
  const search = typeof input?.search === "string" ? input.search.trim().replace(/^\?/, "") : "";

  return search ? `${pathname}?${search}` : pathname;
}

/**
 * Determines whether a link click should be intercepted for a route transition.
 *
 * @param {{
 *   anchorAttributes?: {
 *     href?: string | null,
 *     target?: string | null,
 *     rel?: string | null,
 *     download?: boolean,
 *     isAriaDisabled?: boolean,
 *     skipTransition?: boolean,
 *   },
 *   clickDetails?: {
 *     button?: number,
 *     metaKey?: boolean,
 *     ctrlKey?: boolean,
 *     shiftKey?: boolean,
 *     altKey?: boolean,
 *   },
 *   currentRoute?: string | null,
 *   origin?: string | null,
 * }} input
 * @returns {{ shouldIntercept: boolean, destination: string }}
 */
export function resolveRouteTransition(input) {
  if (shouldSkipInterception(input)) {
    return { shouldIntercept: false, destination: "" };
  }

  const destination = resolveInternalDestination({
    href: input?.anchorAttributes?.href,
    origin: input?.origin,
  });

  if (!destination) {
    return { shouldIntercept: false, destination: "" };
  }

  if (isHashNavigationOnCurrentRoute({ currentRoute: input?.currentRoute, destination })) {
    return { shouldIntercept: false, destination: "" };
  }

  return destination === input?.currentRoute
    ? { shouldIntercept: false, destination: "" }
    : { shouldIntercept: true, destination };
}

/**
 * Determines whether the navigation click should bypass transition handling.
 *
 * @param {Parameters<typeof resolveRouteTransition>[0]} input
 * @returns {boolean}
 */
function shouldSkipInterception(input) {
  const anchor = input?.anchorAttributes;
  const click = input?.clickDetails;
  const href = typeof anchor?.href === "string" ? anchor.href.trim() : "";
  const hasModifier = Boolean(click?.metaKey || click?.ctrlKey || click?.shiftKey || click?.altKey);

  return Boolean(
    !href ||
      href.startsWith("#") ||
      anchor?.download ||
      anchor?.skipTransition ||
      anchor?.isAriaDisabled ||
      anchor?.target === "_blank" ||
      (typeof click?.button === "number" && click.button !== 0) ||
      hasModifier
  );
}

/**
 * Resolves an internal same-origin route destination.
 *
 * @param {{
 *   href?: string | null,
 *   origin?: string | null,
 * }} input
 * @returns {string}
 */
function resolveInternalDestination(input) {
  if (!input?.href || !input?.origin) {
    return "";
  }

  try {
    const url = new URL(input.href, input.origin);

    if (!["http:", "https:"].includes(url.protocol) || url.origin !== input.origin) {
      return "";
    }

    const routeKey = buildRouteKey({
      pathname: url.pathname,
      search: url.search,
    });

    return `${routeKey}${url.hash}`;
  } catch (error) {
    if (error instanceof TypeError) {
      return "";
    }

    throw error;
  }
}

/**
 * Detects same-page hash navigation that should keep default browser behavior.
 *
 * @param {{
 *   currentRoute?: string | null,
 *   destination?: string | null,
 * }} input
 * @returns {boolean}
 */
function isHashNavigationOnCurrentRoute(input) {
  const destination = typeof input?.destination === "string" ? input.destination : "";

  if (!destination.includes("#")) {
    return false;
  }

  const [nextRoute] = destination.split("#");
  return nextRoute === (input?.currentRoute || "");
}
