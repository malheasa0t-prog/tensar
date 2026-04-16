import React from "react";

const NextImage = React.forwardRef(function NextImage(
  {
    alt = "",
    fill = false,
    height,
    sizes,
    src,
    style,
    width,
    ...props
  },
  ref
) {
  const resolvedStyle = fill
    ? {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: style?.objectFit || "cover",
        ...style
      }
    : style;

  return (
    <img
      ref={ref}
      alt={alt}
      height={fill ? undefined : height}
      sizes={sizes}
      src={src}
      style={resolvedStyle}
      width={fill ? undefined : width}
      {...props}
    />
  );
});

export default NextImage;
