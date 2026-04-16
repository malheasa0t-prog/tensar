/**
 * Next.js Link Compatibility Shim for React Router DOM.
 *
 * Maps Next.js <Link href="..."> to React Router <Link to="...">.
 * Preserves all other props (className, children, etc.).
 */

import { forwardRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';

/**
 * Shim component that maps Next.js Link props to React Router Link.
 *
 * @param {object} props
 * @param {string} props.href - The destination URL (Next.js convention)
 * @param {boolean} [props.prefetch] - Ignored (Next.js only)
 * @param {boolean} [props.replace] - Use replace navigation
 * @param {boolean} [props.scroll] - Ignored (Next.js only)
 * @param {React.ReactNode} props.children
 * @param {React.Ref} ref
 * @returns {JSX.Element}
 */
const Link = forwardRef(function Link(
  { href, prefetch, scroll, replace, children, ...rest },
  ref
) {
  if (!href) {
    return <a ref={ref} {...rest}>{children}</a>;
  }

  const isExternal = typeof href === 'string' && (
    href.startsWith('http') ||
    href.startsWith('//') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  );

  const isHashOrHtml = typeof href === 'string' && (
    href.endsWith('.html') ||
    href.startsWith('#')
  );

  if (isExternal || isHashOrHtml) {
    return <a ref={ref} href={href} {...rest}>{children}</a>;
  }

  return (
    <RouterLink ref={ref} to={href} replace={replace} {...rest}>
      {children}
    </RouterLink>
  );
});

Link.displayName = 'Link';

export default Link;
