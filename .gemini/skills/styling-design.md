# 🎨 TechZone — Styling & Design System Skill

## Design Identity
- **Theme**: Dark mode with purple/neon accents
- **Direction**: RTL (Arabic) — always use physical CSS (`right`/`left`)
- **Typography**: Cairo (Arabic) + Inter (Latin) from Google Fonts
- **Aesthetic**: Glassmorphism, neon glows, smooth animations

## CSS Architecture

### File Organization
```
app/techfix-tokens.css        → Design tokens (CSS custom properties)
app/techfix-neon.css          → Neon glow effects and animations
app/techfix-neon-effects.css  → Extended neon effect library
app/techfix-home-purple.css   → Homepage-specific purple theme
app/techfix-layout.css        → Layout grid and spacing
app/techfix-pages.css         → Page-level styles
app/techfix-services.css      → Services page styles
app/techfix-footer.css        → Footer styles
app/techfix-checkout.css      → Checkout page styles
app/techfix-sidebar-layout.css→ Sidebar navigation styles
app/techfix-support.css       → Support/contact page styles
```

### Component Styles
Every component uses CSS Modules: `ComponentName.module.css`

### Key Design Tokens
```css
:root {
  --bg-primary: #0a0a1a;
  --bg-secondary: #111128;
  --surface-card: rgba(255, 255, 255, 0.04);
  --surface-hover: rgba(255, 255, 255, 0.08);
  --border-subtle: rgba(255, 255, 255, 0.08);
  --text-primary: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.7);
  --accent-purple: #a855f7;
  --accent-neon: #c084fc;
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
}
```

## RTL Rules (CRITICAL)

### ✅ DO — Physical Properties
```css
.element {
  padding-right: 1rem;
  padding-left: 2rem;
  margin-right: auto;
  text-align: right;
  right: 0;
}
```

### ❌ DON'T — Logical Properties (Break in RTL)
```css
.element {
  padding-inline-start: 1rem;  /* NEVER use */
  margin-inline-end: auto;     /* NEVER use */
}
```

## Common UI Patterns

### Glassmorphism Card
```css
.card {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

### Neon Glow Button
```css
.btn-neon {
  background: linear-gradient(135deg, #a855f7, #7c3aed);
  border: none;
  border-radius: 12px;
  color: white;
  padding: 0.75rem 1.5rem;
  box-shadow: 0 0 20px rgba(168, 85, 247, 0.4);
  transition: all 0.3s ease;
}
.btn-neon:hover {
  box-shadow: 0 0 30px rgba(168, 85, 247, 0.6);
  transform: translateY(-2px);
}
```

### Smooth Transitions
```css
.element {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

## Responsive Breakpoints
```css
/* Mobile first */
@media (min-width: 640px)  { /* sm */ }
@media (min-width: 768px)  { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
```

## Icons
Use Lucide React for all icons:
```jsx
import { ShoppingCart, Heart, Search } from 'lucide-react';
<ShoppingCart size={20} />
```

## Animation Patterns
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes pulse-neon {
  0%, 100% { box-shadow: 0 0 20px rgba(168, 85, 247, 0.4); }
  50% { box-shadow: 0 0 40px rgba(168, 85, 247, 0.7); }
}
```
