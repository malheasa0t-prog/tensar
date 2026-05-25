import {
  ArrowLeft,
  ArrowUp,
  BadgeCheck,
  Bell,
  Boxes,
  Camera,
  CircleAlert,
  Compass,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Flame,
  Facebook,
  Folder,
  FolderOpen,
  Gamepad2,
  GitCompareArrows,
  Heart,
  Headphones,
  Home,
  House,
  Info,
  Instagram,
  Laptop,
  LayoutDashboard,
  Linkedin,
  Lock,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Monitor,
  MoonStar,
  Package,
  Palette,
  PhoneCall,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  SunMedium,
  TriangleAlert,
  Truck,
  UserRound,
  Wallet,
  Wrench,
  X,
  Youtube,
  Zap,
} from "lucide-react";
import { getSocialBrandIcon } from "@/lib/socialBrandIcons";

const ICONS = {
  "arrow-left": ArrowLeft,
  "arrow-up": ArrowUp,
  "badge-check": BadgeCheck,
  bell: Bell,
  boxes: Boxes,
  camera: Camera,
  "circle-alert": CircleAlert,
  compass: Compass,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  clock: Clock3,
  compare: GitCompareArrows,
  "credit-card": CreditCard,
  flame: Flame,
  facebook: Facebook,
  folder: Folder,
  "folder-open": FolderOpen,
  gamepad: Gamepad2,
  heart: Heart,
  headphones: Headphones,
  home: Home,
  house: House,
  info: Info,
  instagram: Instagram,
  laptop: Laptop,
  dashboard: LayoutDashboard,
  linkedin: Linkedin,
  lock: Lock,
  mail: Mail,
  "map-pin": MapPin,
  menu: Menu,
  message: MessageCircle,
  monitor: Monitor,
  moon: MoonStar,
  package: Package,
  palette: Palette,
  phone: PhoneCall,
  refresh: RefreshCw,
  search: Search,
  send: Send,
  settings: Settings2,
  shield: ShieldCheck,
  bag: ShoppingBag,
  cart: ShoppingCart,
  sparkles: Sparkles,
  store: Store,
  sun: SunMedium,
  "triangle-alert": TriangleAlert,
  truck: Truck,
  user: UserRound,
  wallet: Wallet,
  wrench: Wrench,
  x: X,
  youtube: Youtube,
  zap: Zap,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  "layout-dashboard": LayoutDashboard,
  "message-circle": MessageCircle,
  "phone-call": PhoneCall,
  "refresh-cw": RefreshCw,
  "shield-check": ShieldCheck,
  "map-pin-alt": MapPin,
  "folder-kanban": FolderOpen,
  "🛍️": ShoppingBag,
  "🛒": ShoppingCart,
  "🔧": Wrench,
  "🛡️": ShieldCheck,
  "🚚": Truck,
  "🔄": RefreshCw,
  "🎧": Headphones,
  "📁": Folder,
  "📂": FolderOpen,
  "✨": Sparkles,
  "🔥": Flame,
  "⚡": Zap,
  "📷": Camera,
  "🎮": Gamepad2,
  "💻": Laptop,
  "🖥️": Monitor,
  "💬": MessageCircle,
  "👤": UserRound,
  "🔐": Lock,
  "🌙": MoonStar,
  "☀️": SunMedium,
  "🎨": Palette,
  "💳": CreditCard,
  "📍": MapPin,
  "✉️": Mail,
  "🕐": Clock3,
  "💰": Wallet,
};

function SocialBrandIcon({ name, size = 18, className, ...props }) {
  const icon = getSocialBrandIcon(name);
  const resolvedSize = Number.isFinite(size) && size > 0 ? size : 18;

  if (!icon) {
    return null;
  }

  return (
    <svg
      width={resolvedSize}
      height={resolvedSize}
      viewBox={icon.viewBox}
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={icon.path} fill="currentColor" />
    </svg>
  );
}

function resolveHeuristicIcon(name = "") {
  const value = String(name).trim().toLowerCase();

  if (!value) return Package;
  if (value.includes("steam") || value.includes("game") || value.includes("ببجي")) return Gamepad2;
  if (value.includes("laptop") || value.includes("لاب")) return Laptop;
  if (value.includes("monitor") || value.includes("screen") || value.includes("شاش")) return Monitor;
  if (value.includes("repair") || value.includes("صيانة")) return Wrench;
  if (value.includes("wallet") || value.includes("رصيد") || value.includes("دفع")) return Wallet;
  if (value.includes("folder") || value.includes("category") || value.includes("قسم")) return Folder;
  if (value.includes("service") || value.includes("خدمة")) return Settings2;

  return Package;
}

export default function AppIcon({
  name,
  size = 18,
  strokeWidth = 2,
  className,
  ...props
}) {
  const key = String(name || "").trim();
  const brandIcon = getSocialBrandIcon(key);

  if (brandIcon) {
    return <SocialBrandIcon name={key} size={size} className={className} {...props} />;
  }

  const Icon =
    ICONS[key] ||
    ICONS[key.toLowerCase()] ||
    resolveHeuristicIcon(key);

  return <Icon size={size} strokeWidth={strokeWidth} className={className} {...props} />;
}
