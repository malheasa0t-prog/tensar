/**
 * Next.js Image compatibility shim.
 */

import { forwardRef } from 'react';
import { optimizeImageSrc } from '@/lib/imageUtils';

/**
 * Extracts the most useful pixel width from a sizes string.
 *
 * @param {string | undefined} sizes
 * @returns {number | undefined}
 */
function inferWidthFromSizes(sizes) {
  if (typeof sizes !== 'string') {
    return undefined;
  }

  const matches = sizes.match(/(\d+)px/g);
  return matches?.length ? Number(matches[matches.length - 1].replace('px', '')) : undefined;
}

/**
 * Maps Next.js Image props to a standard img element.
 *
 * @param {object} props
 * @param {string} props.src
 * @param {string} props.alt
 * @param {number} [props.width]
 * @param {number} [props.height]
 * @param {boolean} [props.fill]
 * @param {string} [props.sizes]
 * @param {number} [props.quality]
 * @param {boolean} [props.priority]
 * @param {string} [props.loading]
 * @param {React.Ref} ref
 * @returns {JSX.Element}
 */
const Image = forwardRef(function Image(
  {
    src,
    alt = '',
    width,
    height,
    fill,
    sizes,
    quality,
    priority,
    unoptimized,
    loading,
    placeholder,
    blurDataURL,
    onLoadingComplete,
    style,
    ...rest
  },
  ref
) {
  const imgStyle = { ...style };

  if (fill) {
    imgStyle.position = 'absolute';
    imgStyle.top = 0;
    imgStyle.left = 0;
    imgStyle.width = '100%';
    imgStyle.height = '100%';
    imgStyle.objectFit = imgStyle.objectFit || 'cover';
  }

  const resolvedWidth = width || inferWidthFromSizes(sizes);
  const optimizedSrc = unoptimized
    ? src || ''
    : optimizeImageSrc({ quality, src: src || '', width: resolvedWidth });
  const loadingAttr = priority ? 'eager' : loading || 'lazy';

  return (
    <img
      ref={ref}
      src={optimizedSrc}
      alt={alt}
      width={width}
      height={height}
      loading={loadingAttr}
      decoding={priority ? 'sync' : 'async'}
      fetchpriority={priority ? 'high' : undefined}
      style={Object.keys(imgStyle).length > 0 ? imgStyle : undefined}
      {...rest}
    />
  );
});

Image.displayName = 'Image';

export default Image;
