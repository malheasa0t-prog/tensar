/**
 * Service worker registration helpers.
 */

const SERVICE_WORKER_PATH = '/sw.js';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

/**
 * Returns whether the current browser can register a service worker safely.
 *
 * @param {{ navigator?: Navigator, window?: Window }} [environment]
 * @returns {boolean}
 */
export function canRegisterServiceWorker(environment = {}) {
  const windowObject = environment.window || globalThis.window;
  const navigatorObject = environment.navigator || globalThis.navigator;

  if (!windowObject || !navigatorObject?.serviceWorker) {
    return false;
  }

  return Boolean(
    windowObject.isSecureContext || LOCAL_HOSTS.has(windowObject.location?.hostname || '')
  );
}

/**
 * Defers a callback until the browser is idle or a short timeout has passed.
 *
 * @param {() => void} callback
 * @param {Window} windowObject
 * @returns {void}
 */
function scheduleWhenIdle(callback, windowObject) {
  if (typeof windowObject.requestIdleCallback === 'function') {
    windowObject.requestIdleCallback(callback, { timeout: 1200 });
    return;
  }

  windowObject.setTimeout(callback, 180);
}

/**
 * Registers the storefront service worker after the page is fully loaded.
 *
 * @returns {Promise<ServiceWorkerRegistration | null>}
 */
export function registerServiceWorker() {
  if (!canRegisterServiceWorker()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const windowObject = window;

    /**
     * Performs the actual registration during an idle slot.
     *
     * @returns {void}
     */
    function registerWhenReady() {
      scheduleWhenIdle(() => {
        navigator.serviceWorker.register(SERVICE_WORKER_PATH).then(resolve).catch(() => resolve(null));
      }, windowObject);
    }

    if (document.readyState === 'complete') {
      registerWhenReady();
      return;
    }

    windowObject.addEventListener('load', registerWhenReady, { once: true });
  });
}
