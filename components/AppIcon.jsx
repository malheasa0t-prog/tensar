import {
  ArrowLeft,
  BadgeCheck,
  Boxes,
  Camera,
  ChevronLeft,
  Clock3,
  CreditCard,
  Flame,
  Facebook,
  Folder,
  FolderOpen,
  Gamepad2,
  Headphones,
  Home,
  House,
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
  Send,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  SunMedium,
  Truck,
  UserRound,
  Wallet,
  Wrench,
  Youtube,
  Zap,
} from "lucide-react";

const ICONS = {
  "arrow-left": ArrowLeft,
  "badge-check": BadgeCheck,
  boxes: Boxes,
  camera: Camera,
  "chevron-left": ChevronLeft,
  clock: Clock3,
  "credit-card": CreditCard,
  flame: Flame,
  facebook: Facebook,
  folder: Folder,
  "folder-open": FolderOpen,
  gamepad: Gamepad2,
  headphones: Headphones,
  home: Home,
  house: House,
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
  send: Send,
  settings: Settings2,
  shield: ShieldCheck,
  bag: ShoppingBag,
  cart: ShoppingCart,
  sparkles: Sparkles,
  store: Store,
  sun: SunMedium,
  truck: Truck,
  user: UserRound,
  wallet: Wallet,
  wrench: Wrench,
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
  const Icon =
    ICONS[key] ||
    ICONS[key.toLowerCase()] ||
    resolveHeuristicIcon(key);

  return <Icon size={size} strokeWidth={strokeWidth} className={className} {...props} />;
}
