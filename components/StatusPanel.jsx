import AppIcon from "./AppIcon";
import ScrollReveal from "./ScrollReveal";

export default function StatusPanel({
  icon = "sparkles",
  eyebrow,
  title,
  description,
  actions,
  tone = "default",
  compact = false,
}) {
  return (
    <ScrollReveal variant="zoom-in">
      <div className={`state-panel tone-${tone}${compact ? " is-compact" : ""}`}>
        {eyebrow ? <span className="state-panel-eyebrow">{eyebrow}</span> : null}

        <div className="state-panel-icon">
          <AppIcon name={icon} size={30} />
        </div>

        <div className="state-panel-copy">
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>

        {actions ? <div className="state-panel-actions">{actions}</div> : null}
      </div>
    </ScrollReveal>
  );
}
