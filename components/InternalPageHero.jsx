import Breadcrumbs from "./Breadcrumbs";
import AppIcon from "./AppIcon";

export default function InternalPageHero({
  items = [],
  badgeIcon = "sparkles",
  badgeLabel,
  title,
  description,
  stats = [],
  actions,
  summary,
}) {
  return (
    <section className="page-hero page-hero--interior">
      <div className="container">
        <div className={`internal-hero-shell surface-panel${summary ? " has-summary" : ""}`}>
          <div className="internal-hero-main">
            <div className="section-topbar">
              <Breadcrumbs items={items} />

              {badgeLabel ? (
                <span className="section-badge">
                  <AppIcon name={badgeIcon} size={14} />
                  {badgeLabel}
                </span>
              ) : null}
            </div>

            <div className="internal-hero-copy">
              <h1>{title}</h1>
              {description ? <p>{description}</p> : null}
            </div>

            {actions ? <div className="internal-hero-actions">{actions}</div> : null}

            {stats.length > 0 ? (
              <div className="internal-hero-stats">
                {stats.map((stat) => (
                  <div
                    key={`${stat.label}-${stat.value}`}
                    className={`internal-hero-stat${stat.tone ? ` tone-${stat.tone}` : ""}`}
                  >
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {summary ? <aside className="internal-hero-summary">{summary}</aside> : null}
        </div>
      </div>
    </section>
  );
}
