/**
 * Next.js Image Compatibility Shim.
 *
 * Converts Next.js <Image> props to a standard <img> element.
 * Handles the 'fill' layout mode with absolute positioning.
 */

import { forwardRef } from 'react';

/**
 * Maps Next.js Image component to a standard img element.
 *
 * @param {object} props
 * @param {string} props.src - Image source URL
 * @param {string} props.alt - Alt text
 * @param {number} [props.width] - Width in pixels
 * @param {number} [props.height] - Height in pixels
 * @param {boolean} [props.fill] - Fill parent container
 * @param {string} [props.sizes] - Ignored
 * @param {number} [props.quality] - Ignored
 * @param {boolean} [props.priority] - Maps to eager loading
 * @param {boolean} [props.unoptimized] - Ignored
 * @param {string} [props.loading] - Loading strategy
 * @param {Function} [props.onLoad] - Load callback
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

  const loadingAttr = priority ? 'eager' : loading || 'lazy';

  return (
    <img
      ref={ref}
      src={src || ''}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      loading={loadingAttr}
      style={Object.keys(imgStyle).length > 0 ? imgStyle : undefined}
      {...rest}
    />
  );
});

Image.displayName = 'Image';

export default Image;
