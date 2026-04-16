/**
 * Next.js dynamic() Compatibility Shim.
 *
 * Maps next/dynamic to React.lazy with Suspense fallback.
 */

import { lazy, Suspense, createElement } from 'react';

/**
 * Mimics Next.js dynamic import with React.lazy.
 *
 * @param {Function} importFn - Dynamic import function
 * @param {object} [options] - Options
 * @param {Function} [options.loading] - Loading component factory
 * @param {boolean} [options.ssr] - Ignored (always client-side)
 * @returns {React.ComponentType}
 */
export default function dynamic(importFn, options = {}) {
  const LazyComponent = lazy(() =>
    importFn().then((mod) => ({
      default: mod.default || mod,
    }))
  );

  const fallback = options.loading ? createElement(options.loading) : null;

  function DynamicWrapper(props) {
    return createElement(
      Suspense,
      { fallback },
      createElement(LazyComponent, props)
    );
  }

  DynamicWrapper.displayName = 'Dynamic';
  return DynamicWrapper;
}
