import { useEffect } from "react";

export default function Script({ children, id, src }) {
  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const existing = id ? document.getElementById(id) : null;
    if (existing) {
      return undefined;
    }

    const script = document.createElement("script");
    if (id) {
      script.id = id;
    }

    if (src) {
      script.src = src;
      script.async = true;
    } else if (children) {
      script.text = typeof children === "string" ? children : "";
    }

    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [children, id, src]);

  return null;
}
