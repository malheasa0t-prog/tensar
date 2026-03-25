import Link from "next/link";
import AppIcon from "./AppIcon";

export default function Breadcrumbs({ items = [] }) {
  if (!Array.isArray(items) || items.length < 2) return null;

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={`${item.href || item.label}-${index}`} className="breadcrumbs-item">
            {item.href && !isLast ? (
              <Link href={item.href} className="breadcrumbs-link">
                {item.label}
              </Link>
            ) : (
              <span className="breadcrumbs-current" aria-current="page">
                {item.label}
              </span>
            )}

            {!isLast && (
              <AppIcon
                name="chevron-left"
                size={14}
                className="breadcrumbs-separator"
                aria-hidden="true"
              />
            )}
          </span>
        );
      })}
    </nav>
  );
}
