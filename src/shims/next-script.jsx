/**
 * Next.js Script Compatibility Shim.
 *
 * Injects a standard script tag into the document head.
 */

import { useEffect } from 'react';

/**
 * Mimics Next.js Script by injecting a script element.
 *
 * @param {object} props
 * @param {string} [props.src] - Script source URL
 * @param {string} [props.strategy] - Ignored
 * @param {string} [props.id] - Script element ID
 * @param {Function} [props.onLoad] - Load callback
 * @param {string} [props.dangerouslySetInnerHTML] - Inline script content
 * @returns {null}
 */
export default function Script({ src, strategy, id, onLoad, dangerouslySetInnerHTML, ...rest }) {
  useEffect(() => {
    if (!src && !dangerouslySetInnerHTML?.__html) return;

    const existing = id ? document.getElementById(id) : null;
    if (existing) return;

    const script = document.createElement('script');
    if (id) script.id = id;
    if (src) script.src = src;
    script.async = true;

    Object.entries(rest).forEach(([key, value]) => {
      if (typeof value === 'string') {
        script.setAttribute(key, value);
      }
    });

    if (dangerouslySetInnerHTML?.__html) {
      script.textContent = dangerouslySetInnerHTML.__html;
    }

    if (onLoad) {
      script.addEventListener('load', onLoad);
    }

    document.head.appendChild(script);

    return () => {
      try { document.head.removeChild(script); } catch { /* already removed */ }
    };
  }, [src, id]);

  return null;
}
