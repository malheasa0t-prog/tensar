import { useEffect, useState } from "react";

/**
 * Loads async page snapshots in client-rendered routes.
 *
 * @template T
 * @param {() => Promise<T>} loader
 * @param {unknown[]} deps
 * @param {T} initialData
 * @returns {{ data: T, error: Error | null, loading: boolean }}
 */
export function useAsyncPageData(loader, deps, initialData) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      setLoading(true);
      setError(null);

      try {
        const nextData = await loader();
        if (!active) {
          return;
        }

        setData(nextData);
      } catch (nextError) {
        if (!active) {
          return;
        }

        setError(nextError instanceof Error ? nextError : new Error("Failed to load page data."));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void hydrate();

    return () => {
      active = false;
    };
  }, deps);

  return { data, error, loading };
}
