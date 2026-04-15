import React, { Suspense } from "react";

/**
 * Provides a lightweight `next/dynamic` compatibility wrapper for the Vite copy.
 *
 * @param {() => Promise<unknown>} loader
 * @param {{ loading?: () => import("react").ReactNode }} [options]
 * @returns {(props: Record<string, unknown>) => JSX.Element}
 */
export default function dynamic(loader, options = {}) {
  const LazyComponent = React.lazy(async () => {
    const module = await loader();
    return { default: module.default || module };
  });

  const LoadingComponent = typeof options.loading === "function" ? options.loading : () => null;

  return function DynamicComponent(props) {
    return (
      <Suspense fallback={<LoadingComponent />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}
