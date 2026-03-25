export const DEFAULT_COMPANY = {
  name: 'TechZone',
  slogan: 'بوابتك السريعة لشراء الأجهزة وخدمات الصيانة باحترافية.',
  phone: '',
  email: '',
  address: '',
};

export const DEFAULT_MARQUEE_ITEMS = [
  'عروض مميزة على أجهزة الألعاب',
  'توصيل مجاني للطلبات فوق 50 د.أ',
  'ضمان سنتين على المنتجات المشمولة',
  'حجز صيانة سريع مع متابعة واضحة',
];

export const DEFAULT_HERO = {
  trustBadge: 'متجر وصيانة احترافية في الأردن يخدم أكثر من 12,000 عميل',
  title: 'عالمك التقني',
  titleHighlight: 'يبدأ من هنا',
  description:
    'نوفر لك أحدث أجهزة الكمبيوتر واللاب توبات وأجهزة الألعاب مع خدمات صيانة احترافية وتجميع مخصص حسب طلبك، في تجربة شراء واضحة وسريعة.',
};

export const DEFAULT_TRUST_BAR = [
  { icon: 'truck', title: 'توصيل مجاني', subtitle: 'للطلبات فوق 50 د.أ' },
  { icon: 'headphones', title: 'دعم متواصل', subtitle: 'فريق مختص لخدمتك' },
];

export const DEFAULT_STATS = [
  {
    value: 12000,
    suffix: '+',
    label: 'عميل نشط',
    hint: 'أفراد وشركات يثقون بخدماتنا',
    icon: 'user',
    accent: '#22c55e',
    glow: 'rgba(34,197,94,0.24)',
  },
  {
    value: 34000,
    suffix: '+',
    label: 'طلبات منجزة',
    hint: 'تنفيذ متواصل بدقة وسرعة',
    icon: 'shopping-bag',
    accent: '#38bdf8',
    glow: 'rgba(56,189,248,0.24)',
  },
  {
    value: 24,
    suffix: 'h',
    label: 'متوسط وقت الصيانة',
    hint: 'تشخيص واضح ومتابعة أسرع',
    icon: 'clock',
    accent: '#f59e0b',
    glow: 'rgba(245,158,11,0.2)',
  },
  {
    value: 98,
    suffix: '%',
    label: 'رضا العملاء',
    hint: 'تجربة موثوقة بعد كل طلب',
    icon: 'shield-check',
    accent: '#34d399',
    glow: 'rgba(52,211,153,0.22)',
  },
];

export const DEFAULT_CUSTOM_BUILD = {
  badge: '⚙️ تجميع احترافي',
  title: 'صمم جهاز أحلامك',
  titleHighlight: '',
  description:
    'نقدم خدمة تجميع أجهزة الكمبيوتر حسب الطلب مع أفضل القطع وأعلى معايير الجودة للاستمتاع بأقوى أداء في الألعاب وبرامج التصميم.',
  features: [
    'استشارة مجانية لاختيار القطع',
    'تركيب احترافي لترتيب الكيابل',
    'تثبيت نظام التشغيل والتعريفات الأساسية',
    'فحص شامل للحرارة والأداء قبل التسليم',
  ],
  ctaLabel: 'اطلب تجميعة الآن',
  ctaHref: '/services',
};

export const DEFAULT_SERVICE_FEATURES = [
  { icon: 'zap', title: 'استجابة سريعة', subtitle: 'تشخيص أولي سريع للحالة' },
  { icon: 'shield-check', title: 'قطع أصلية', subtitle: 'جودة أعلى واعتمادية أفضل' },
  { icon: 'phone', title: 'متابعة واضحة', subtitle: 'تحديثات مستمرة على حالة الطلب' },
];

export const DEFAULT_PAYMENT_METHODS = [
  { value: 'cod', label: 'الدفع عند الاستلام' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
  { value: 'wallet', label: 'محفظة' },
];

export const DEFAULT_DELIVERY_METHODS = [
  { value: 'delivery', label: 'توصيل' },
  { value: 'pickup', label: 'استلام من المحل' },
];

export const DEFAULT_SERVICE_TYPES = [
  { value: 'صيانة عاجلة', label: '🔧 صيانة عاجلة' },
  { value: 'تجميعة مخصصة', label: '🖥️ تجميعة مخصصة' },
  { value: 'ترقية جهاز', label: '⚡ ترقية جهاز' },
  { value: 'تركيب شبكات', label: '🌐 تركيب شبكات' },
  { value: 'تنصيب برمجيات', label: '💿 تنصيب برمجيات' },
];

export const DEFAULT_NAVIGATION = {
  headerBefore: [
    { href: '/', label: 'الرئيسية' },
    { href: '/products', label: 'المنتجات' },
    { href: '/accessories', label: 'الإكسسوارات' },
  ],
  headerAfter: [
    { href: '/services', label: 'خدمات الصيانة' },
    { href: '/contact', label: 'تواصل معنا' },
  ],
  footerQuick: [
    { href: '/', label: 'الرئيسية' },
    { href: '/products', label: 'المنتجات' },
    { href: '/accessories', label: 'الإكسسوارات' },
    { href: '/subscriptions', label: 'الشحن والاشتراكات' },
    { href: '/services', label: 'خدمات الصيانة' },
  ],
  footerSupport: [
    { href: '/dashboard', label: 'حسابي' },
    { href: '/checkout', label: 'إتمام الشراء' },
    { href: '/contact', label: 'التواصل' },
  ],
  footerBar: [
    { href: '/products', label: 'المنتجات' },
    { href: '/contact', label: 'التواصل' },
  ],
  mobilePrimary: [
    { href: '/products', label: 'تسوق' },
    { href: '/services', label: 'الصيانة' },
    { href: '/subscriptions', label: 'الاشتراكات' },
    { href: '/contact', label: 'التواصل' },
  ],
};

export const PAYMENT_LABELS = {
  mada: 'مدى',
  card: 'بطاقة بنكية',
  applepay: 'Apple Pay',
  cod: 'الدفع عند الاستلام',
  bank_transfer: 'تحويل بنكي',
  wallet: 'محفظة',
};

export const SOCIAL_CHANNELS = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: 'message',
    description: 'راسل فريق المتجر مباشرة للحصول على مساعدة سريعة.',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    icon: 'instagram',
    description: 'تابع أحدث العروض والصور والمنتجات الجديدة.',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    icon: 'sparkles',
    description: 'شاهد الفيديوهات القصيرة والمحتوى اليومي.',
  },
  {
    key: 'x',
    label: 'X',
    icon: 'send',
    description: 'اطلع على آخر الأخبار والتنبيهات السريعة.',
  },
  {
    key: 'snapchat',
    label: 'Snapchat',
    icon: 'message-circle',
    description: 'تابع القصص واللقطات السريعة من المتجر.',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    icon: 'facebook',
    description: 'زر صفحتنا الرسمية وتابع المنشورات والعروض.',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    icon: 'youtube',
    description: 'شاهد الفيديوهات والشروحات والمراجعات.',
  },
  {
    key: 'telegram',
    label: 'Telegram',
    icon: 'send',
    description: 'انضم إلى القناة أو راسلنا عبر تيليجرام.',
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    icon: 'linkedin',
    description: 'تابع تحديثات الشركة وحضورها المهني.',
  },
];
