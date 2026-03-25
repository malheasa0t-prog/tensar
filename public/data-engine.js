// ===== TechZone Data Engine (Supabase Full Sync + Realtime) =====
(function () {
    'use strict';

    // ===== Supabase Config =====
    const SUPABASE_URL = window.__TZ_SUPABASE_URL || '';
    const SUPABASE_ANON_KEY = window.__TZ_SUPABASE_ANON_KEY || '';
    const LEGACY_ADMIN_WRITE_ENABLED = window.__TZ_LEGACY_ADMIN_WRITE_ENABLED === true;

    if (!window.supabase) {
        console.error('Supabase JS client not loaded!');
        return;
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('Supabase config is missing. Define window.__TZ_SUPABASE_URL and window.__TZ_SUPABASE_ANON_KEY in admin-config.js');
        return;
    }

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ===== Local DB =====
    let db = {
        users: [],
        categories: [],
        products: [],
        services: [], // New Digital Services table
        orders: [],
        serviceOrders: [],
        deposits: [],
        coupons: [],
        settings: {
            company: { name: 'TechZone', phone: '', email: '', address: '' },
            payments: { mada: true, card: true, applepay: true, cod: true, bank_transfer: true },
            shipping: { standardFee: 20, expressFee: 35, freeShippingThreshold: 500, freeAbove: 500 },
            deliveryModes: [
                { id: 'delivery', name: 'توصيل للمنزل', fee: 20 },
                { id: 'pickup', name: 'استلام من المحل', fee: 0 }
            ]
        },
        repairServices: [],
        repairBookings: [],
        contactMessages: [],
        logs: [],
        cart: []
    };

    // Load cart from localStorage
    try {
        const localCart = localStorage.getItem('tz_cart');
        if (localCart) db.cart = JSON.parse(localCart);
    } catch (e) { }

    // ===== Roles / RBAC =====
    const ROLES = {
        'super_admin': { level: 10, label: 'مدير عام' },
        'admin': { level: 8, label: 'مدير النظام' },
        'technician': { level: 5, label: 'فني صيانة' },
        'employee': { level: 3, label: 'موظف مبيعات' },
        'customer': { level: 1, label: 'عميل' }
    };
    ROLES.user = { level: 1, label: 'مستخدم' };

    const ADMIN_SECTIONS = [
        { id: 'dashboard', minLevel: 3, icon: 'fa-chart-pie', label: 'لوحة المعلومات' },
        { id: 'orders', minLevel: 3, icon: 'fa-shopping-bag', label: 'الطلبات' },
        { id: 'products', minLevel: 8, icon: 'fa-box-open', label: 'المنتجات' },
        { id: 'categories', minLevel: 8, icon: 'fa-tags', label: 'الفئات' },
        { id: 'services', minLevel: 8, icon: 'fa-bolt', label: 'الخدمات' },
        { id: 'customers', minLevel: 3, icon: 'fa-users', label: 'العملاء' },
        { id: 'coupons', minLevel: 8, icon: 'fa-ticket-alt', label: 'الكوبونات' },
        { id: 'messages', minLevel: 3, icon: 'fa-envelope', label: 'رسائل التواصل' },
        { id: 'settings', minLevel: 10, icon: 'fa-cog', label: 'الإعدادات' },
        { id: 'logs', minLevel: 10, icon: 'fa-history', label: 'سجل العمليات' }
    ];
    ADMIN_SECTIONS.splice(6, 0, { id: 'deposits', minLevel: 8, icon: 'fa-money-check-alt', label: 'الإيداعات' });

    const ACCESSORY_SECTION_NAME = 'منتجات اكسسوارات';
    const ACCESSORY_PUBLIC_LABEL = 'إكسسوارات';
    const ACCESSORY_MAIN_CATEGORY_ID = 'cat-accessories-direct-root';
    const ACCESSORY_SUBCATEGORY_ID = 'cat-accessories-direct-items';
    const ACCESSORY_MAIN_CATEGORY_SLUG = 'accessories-direct-root';
    const ACCESSORY_SUBCATEGORY_SLUG = 'accessories-direct-items';
    const ACCESSORY_MAIN_CATEGORY = {
        id: ACCESSORY_MAIN_CATEGORY_ID,
        name: ACCESSORY_SECTION_NAME,
        parentId: null,
        status: 'active',
        sortOrder: 9991,
        icon: 'fa-headphones',
        image: '',
        description: 'فئة داخلية مخصصة لمنتجات الإكسسوارات المباشرة.',
        slug: ACCESSORY_MAIN_CATEGORY_SLUG,
        showInNavbar: false
    };
    const ACCESSORY_SUBCATEGORY = {
        id: ACCESSORY_SUBCATEGORY_ID,
        name: 'قسم مباشر',
        parentId: ACCESSORY_MAIN_CATEGORY_ID,
        status: 'active',
        sortOrder: 9992,
        icon: 'fa-box-open',
        image: '',
        description: 'فئة فرعية داخلية تحفظ منتجات الإكسسوارات التي تظهر مباشرة في صفحة المنتجات.',
        slug: ACCESSORY_SUBCATEGORY_SLUG,
        showInNavbar: false
    };

    function isAccessoryCatalogCategoryId(categoryId) {
        return categoryId === ACCESSORY_MAIN_CATEGORY_ID || categoryId === ACCESSORY_SUBCATEGORY_ID;
    }

    function isAccessoryProductCategoryId(categoryId) {
        return categoryId === ACCESSORY_SUBCATEGORY_ID;
    }

    function isAccessoryProduct(product) {
        return !!product && (
            product.productType === 'accessory' ||
            !product.categoryId ||
            isAccessoryProductCategoryId(product.categoryId)
        );
    }

    function getVisibleCatalogCategories() {
        return db.categories.filter((category) => !isAccessoryCatalogCategoryId(category.id));
    }

    function getCatalogProducts() {
        return db.products.filter((product) => product.status === 'active' && !isAccessoryProduct(product));
    }

    function getAccessoryProducts() {
        return db.products.filter((product) => product.status === 'active' && isAccessoryProduct(product));
    }

    function detectDataScope() {
        const override = typeof window.__TZ_DATA_SCOPE === 'string'
            ? window.__TZ_DATA_SCOPE.toLowerCase().trim()
            : '';
        if (override) {
            return override;
        }

        const path = (window.location.pathname || '').toLowerCase();
        if (document.getElementById('adminLayout') || path.endsWith('/admin') || path.endsWith('/admin.html') || path.endsWith('admin.html')) {
            return 'admin';
        }
        if (path.endsWith('/products')) {
            return 'products';
        }
        if (path.endsWith('/services')) {
            return 'services';
        }
        return 'storefront';
    }

    const DATA_SCOPE = detectDataScope();
    const DATA_SCOPE_CONFIG = {
        admin: {
            queries: [
                'profiles', 'legacyUsers', 'categories', 'products', 'digitalServices',
                'orders', 'orderItems', 'settings', 'coupons', 'repairServices',
                'repairBookings', 'messages', 'logs', 'deposits', 'serviceOrders'
            ],
            realtime: [
                'products', 'categories', 'services', 'service_orders', 'orders',
                'repair_services', 'repair_bookings', 'contact_messages', 'deposits',
                'coupons', 'settings'
            ]
        },
        storefront: {
            queries: ['categories', 'products', 'settings', 'repairServices'],
            realtime: ['products', 'categories', 'repair_services', 'settings']
        },
        products: {
            queries: ['categories', 'products', 'settings'],
            realtime: ['products', 'categories', 'settings']
        },
        services: {
            queries: ['settings', 'repairServices'],
            realtime: ['repair_services', 'settings']
        }
    };

    function getDataScopeConfig() {
        return DATA_SCOPE_CONFIG[DATA_SCOPE] || DATA_SCOPE_CONFIG.storefront;
    }

    // ===== Utilities =====
    function generateId(prefix = '') {
        return prefix + Math.random().toString(36).substr(2, 9);
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatPrice(price) {
        return Number(price).toLocaleString('ar-JO') + ' د.أ';
    }

    // ===== Supabase Storage =====
    async function uploadImageToStorage(file, pathPrefix = 'uploads') {
        const fileExt = file.name.split('.').pop();
        const fileName = `${pathPrefix}/${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        
        const { data, error } = await supabase.storage
            .from('products')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Storage Upload Error:', error);
            throw error;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('products')
            .getPublicUrl(fileName);

        return publicUrl;
    }

    // ===== Supabase Auth =====
    async function supabaseSignIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { user: null, error: error.message };
        return { user: data.user, error: null };
    }

    async function supabaseSignOut() {
        await supabase.auth.signOut();
    }

    async function getSupabaseUser() {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    }

    // ===== Session =====
    function getSession() {
        try {
            const s = localStorage.getItem('tz_session');
            return s ? JSON.parse(s) : null;
        } catch (e) { return null; }
    }

    function setSession(userId, role, name) {
        const s = { userId, role, name, expires: Date.now() + (24 * 60 * 60 * 1000) };
        localStorage.setItem('tz_session', JSON.stringify(s));
        return s;
    }

    function clearSession() {
        localStorage.removeItem('tz_session');
    }

    // ===== Data Mapping Helpers =====
    function mapUser(u) {
        const normalizedRole = (u.role || 'user').toLowerCase();
        return {
            id: u.user_id || u.id,
            profileId: u.id,
            authUserId: u.user_id || u.id,
            fullName: u.full_name || u.name || u.email || 'مستخدم',
            email: u.email || '',
            phone: u.phone || '',
            country: u.country || '',
            bio: u.bio || '',
            avatarUrl: u.avatar_url || '',
            preferredLanguage: u.preferred_language || 'ar',
            preferredCurrency: u.preferred_currency || 'JOD',
            lastLoginAt: u.last_login_at || null,
            role: normalizedRole === 'customer' ? 'user' : normalizedRole,
            status: u.status || 'active',
            passwordHash: u.password_hash,
            createdAt: u.created_at,
            updatedAt: u.updated_at || null
        };
    }

    function mapCategory(c) {
        return { 
            id: c.id, name: c.name, icon: c.icon, parentId: c.parent_id, 
            image: c.image, description: c.description, sortOrder: c.sort_order || 0,
            status: c.status || 'active', slug: c.slug || '',
            showInNavbar: c.show_in_nav !== false
        };
    }

    function mapProduct(p) {
        return {
            id: p.id, name: p.name, categoryId: p.category_id, brand: p.brand,
            productType: p.product_type || 'physical',
            price: parseFloat(p.price), discountPrice: p.discount_price ? parseFloat(p.discount_price) : 0,
            quantity: p.quantity, rating: parseFloat(p.rating), sold: p.sold, status: p.status,
            description: p.description, specs: p.specs || [], images: p.images || [],
            variants: p.variants || [], lowStockAlert: p.low_stock_alert,
            createdAt: p.created_at, updatedAt: p.updated_at
        };
    }

    function mapDigitalService(s) {
        return {
            id: s.id, name: s.name, categoryId: s.category_id, providerServiceId: s.provider_service_id,
            subcategoryId: s.subcategory_id || s.category_id,
            price: parseFloat(s.price), costPrice: parseFloat(s.cost_price),
            minQty: s.min_qty, maxQty: s.max_qty, description: s.description,
            speed: s.speed, guarantee: s.guarantee, image: s.image,
            status: s.status, sortOrder: s.sort_order || 0, slug: s.slug || '',
            createdAt: s.created_at, updatedAt: s.updated_at
        };
    }

    function mapOrder(o, items) {
        return {
            id: o.id, userId: o.user_id, customerName: o.customer_name,
            customerPhone: o.customer_phone, customerEmail: o.customer_email,
            total: parseFloat(o.total), status: o.status, deliveryMethod: o.delivery_method,
            paymentMethod: o.payment_method, shippingFee: parseFloat(o.shipping_fee) || 0,
            notes: o.notes, createdAt: o.created_at, items: items || []
        };
    }

    function mapCoupon(c) {
        return {
            id: c.id, code: c.code, type: c.type, value: parseFloat(c.value),
            minOrder: parseFloat(c.min_order), maxUses: c.max_uses, usedCount: c.used_count,
            status: c.status, expiresAt: c.expires_at, createdAt: c.created_at
        };
    }

    function mapServiceOrder(o) {
        return {
            id: o.id,
            userId: o.user_id,
            serviceId: o.service_id,
            serviceName: o.service_name,
            link: o.link,
            quantity: Number(o.quantity || 0),
            price: parseFloat(o.price || 0),
            costPrice: parseFloat(o.cost_price || 0),
            total: parseFloat(o.total || 0),
            status: o.status,
            externalOrderId: o.external_order_id || '',
            providerName: o.provider_name || '',
            adminNote: o.admin_note || '',
            createdAt: o.created_at,
            updatedAt: o.updated_at
        };
    }

    function mapRepairService(s) {
        return {
            id: s.id, name: s.name, category: s.category, description: s.description,
            price: parseFloat(s.price) || 0, duration: s.duration, icon: s.icon,
            image: s.image || '', status: s.status, createdAt: s.created_at
        };
    }

    function mapRepairBooking(r) {
        return {
            id: r.id, name: r.name, phone: r.phone, email: r.email,
            serviceId: r.service_id, serviceName: r.service_name, device: r.device,
            description: r.description, preferredDate: r.preferred_date, mode: r.mode,
            status: r.status, createdAt: r.created_at
        };
    }

    function mapContactMessage(m) {
        return {
            id: m.id, name: m.name, email: m.email, phone: m.phone,
            serviceType: m.service_type, message: m.message, status: m.status,
            createdAt: m.created_at
        };
    }

    function mergeUsers(profileRows = [], legacyRows = []) {
        const merged = new Map();

        profileRows.forEach((row) => {
            const mapped = mapUser(row);
            merged.set(mapped.id, mapped);
        });

        legacyRows.forEach((row) => {
            const mapped = mapUser(row);
            const key = mapped.authUserId || mapped.email || mapped.id;
            const existing = merged.get(key);

            if (existing) {
                merged.set(key, {
                    ...mapped,
                    ...existing,
                    email: existing.email || mapped.email || '',
                    phone: existing.phone || mapped.phone || '',
                    fullName: existing.fullName || mapped.fullName,
                    role: existing.role || mapped.role,
                    status: existing.status || mapped.status,
                });
                return;
            }

            merged.set(key, mapped);
        });

        return Array.from(merged.values());
    }

    // ===== Load All Data from Supabase =====
    async function loadDataFromSupabase() {
        try {
            const [profilesRes, legacyUsersRes, catsRes, prodsRes, digitalServicesRes, ordersRes, orderItemsRes, settingsRes,
                couponsRes, servicesRes, repairsRes, messagesRes, logsRes, depositsRes, serviceOrdersRes] = await Promise.all([
                    supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
                    supabase.from('app_users').select('*'),
                    supabase.from('categories').select('*').order('sort_order', { ascending: true }),
                    supabase.from('products').select('*'),
                    supabase.from('services').select('*'), // Digital Services
                    supabase.from('orders').select('*').order('created_at', { ascending: false }),
                    supabase.from('order_items').select('*'),
                    supabase.from('settings').select('*').limit(1),
                    supabase.from('coupons').select('*'),
                    supabase.from('repair_services').select('*').order('created_at', { ascending: true }),
                    supabase.from('repair_bookings').select('*').order('created_at', { ascending: false }),
                    supabase.from('contact_messages').select('*').order('created_at', { ascending: false }),
                    supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(200),
                    supabase.from('deposits').select('*').order('created_at', { ascending: false }),
                    supabase.from('service_orders').select('*').order('created_at', { ascending: false })
                ]);

            db.users = mergeUsers(profilesRes.data || [], legacyUsersRes.data || []);
            if (catsRes.data) db.categories = catsRes.data.map(mapCategory);
            if (prodsRes.data) db.products = prodsRes.data.map(mapProduct);
            if (digitalServicesRes.data) db.services = digitalServicesRes.data.map(mapDigitalService);

            // Orders with items
            if (ordersRes.data) {
                const itemsByOrder = {};
                if (orderItemsRes.data) {
                    orderItemsRes.data.forEach(item => {
                        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
                        itemsByOrder[item.order_id].push({
                            productId: item.product_id, productName: item.product_name,
                            qty: item.qty, price: parseFloat(item.price)
                        });
                    });
                }
                db.orders = ordersRes.data.map(o => mapOrder(o, itemsByOrder[o.id] || []));
            }

            if (settingsRes.data && settingsRes.data.length > 0) {
                db.settings = { ...db.settings, ...settingsRes.data[0].data };
            }

            if (couponsRes.data) db.coupons = couponsRes.data.map(mapCoupon);
            if (servicesRes.data) db.repairServices = servicesRes.data.map(mapRepairService);
            if (repairsRes.data) db.repairBookings = repairsRes.data.map(mapRepairBooking);
            if (messagesRes.data) db.contactMessages = messagesRes.data.map(mapContactMessage);
            if (logsRes.data) {
                db.logs = logsRes.data.map(l => ({
                    id: l.id, action: l.action, actorId: l.actor_id,
                    details: l.details, timestamp: l.timestamp
                }));
            }

            // New Phase 1 tables
            if (depositsRes && depositsRes.data) db.deposits = depositsRes.data.map((deposit) => ({
                ...deposit,
                amount: parseFloat(deposit.amount || 0)
            }));
            if (serviceOrdersRes && serviceOrdersRes.data) db.serviceOrders = serviceOrdersRes.data.map(mapServiceOrder);

        } catch (error) {
            console.error('❌ Error fetching from Supabase:', error);
        }

        window.dispatchEvent(new Event('tz-ready'));
    }

    async function loadDataFromSupabaseByScope() {
        try {
            const config = getDataScopeConfig();
            const enabledQueries = new Set(config.queries);
            const queries = {};
            if (enabledQueries.has('profiles')) queries.profilesRes = supabase.from('user_profiles').select('*').order('created_at', { ascending: false });
            if (enabledQueries.has('legacyUsers')) queries.legacyUsersRes = supabase.from('app_users').select('*');
            if (enabledQueries.has('categories')) queries.catsRes = supabase.from('categories').select('*').order('sort_order', { ascending: true });
            if (enabledQueries.has('products')) queries.prodsRes = supabase.from('products').select('*');
            if (enabledQueries.has('digitalServices')) queries.digitalServicesRes = supabase.from('services').select('*');
            if (enabledQueries.has('orders')) queries.ordersRes = supabase.from('orders').select('*').order('created_at', { ascending: false });
            if (enabledQueries.has('orderItems')) queries.orderItemsRes = supabase.from('order_items').select('*');
            if (enabledQueries.has('settings')) queries.settingsRes = supabase.from('settings').select('*').limit(1);
            if (enabledQueries.has('coupons')) queries.couponsRes = supabase.from('coupons').select('*');
            if (enabledQueries.has('repairServices')) queries.servicesRes = supabase.from('repair_services').select('*').order('created_at', { ascending: true });
            if (enabledQueries.has('repairBookings')) queries.repairsRes = supabase.from('repair_bookings').select('*').order('created_at', { ascending: false });
            if (enabledQueries.has('messages')) queries.messagesRes = supabase.from('contact_messages').select('*').order('created_at', { ascending: false });
            if (enabledQueries.has('logs')) queries.logsRes = supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(200);
            if (enabledQueries.has('deposits')) queries.depositsRes = supabase.from('deposits').select('*').order('created_at', { ascending: false });
            if (enabledQueries.has('serviceOrders')) queries.serviceOrdersRes = supabase.from('service_orders').select('*').order('created_at', { ascending: false });

            const results = Object.fromEntries(
                await Promise.all(
                    Object.entries(queries).map(async ([key, query]) => [key, await query])
                )
            );

            const profilesRes = results.profilesRes;
            const legacyUsersRes = results.legacyUsersRes;
            const catsRes = results.catsRes;
            const prodsRes = results.prodsRes;
            const digitalServicesRes = results.digitalServicesRes;
            const ordersRes = results.ordersRes;
            const orderItemsRes = results.orderItemsRes;
            const settingsRes = results.settingsRes;
            const couponsRes = results.couponsRes;
            const servicesRes = results.servicesRes;
            const repairsRes = results.repairsRes;
            const messagesRes = results.messagesRes;
            const logsRes = results.logsRes;
            const depositsRes = results.depositsRes;
            const serviceOrdersRes = results.serviceOrdersRes;

            if (profilesRes || legacyUsersRes) {
                db.users = mergeUsers(
                    profilesRes && profilesRes.data ? profilesRes.data : [],
                    legacyUsersRes && legacyUsersRes.data ? legacyUsersRes.data : []
                );
            }
            if (catsRes && catsRes.data) db.categories = catsRes.data.map(mapCategory);
            if (prodsRes && prodsRes.data) db.products = prodsRes.data.map(mapProduct);
            if (digitalServicesRes && digitalServicesRes.data) db.services = digitalServicesRes.data.map(mapDigitalService);

            if (ordersRes && ordersRes.data) {
                const itemsByOrder = {};
                if (orderItemsRes && orderItemsRes.data) {
                    orderItemsRes.data.forEach(item => {
                        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
                        itemsByOrder[item.order_id].push({
                            productId: item.product_id,
                            productName: item.product_name,
                            qty: item.qty,
                            price: parseFloat(item.price)
                        });
                    });
                }
                db.orders = ordersRes.data.map((order) => mapOrder(order, itemsByOrder[order.id] || []));
            }

            if (settingsRes && settingsRes.data && settingsRes.data.length > 0) {
                db.settings = { ...db.settings, ...settingsRes.data[0].data };
            }

            if (couponsRes && couponsRes.data) db.coupons = couponsRes.data.map(mapCoupon);
            if (servicesRes && servicesRes.data) db.repairServices = servicesRes.data.map(mapRepairService);
            if (repairsRes && repairsRes.data) db.repairBookings = repairsRes.data.map(mapRepairBooking);
            if (messagesRes && messagesRes.data) db.contactMessages = messagesRes.data.map(mapContactMessage);
            if (logsRes && logsRes.data) {
                db.logs = logsRes.data.map((log) => ({
                    id: log.id,
                    action: log.action,
                    actorId: log.actor_id,
                    details: log.details,
                    timestamp: log.timestamp
                }));
            }
            if (depositsRes && depositsRes.data) {
                db.deposits = depositsRes.data.map((deposit) => ({
                    ...deposit,
                    amount: parseFloat(deposit.amount || 0)
                }));
            }
            if (serviceOrdersRes && serviceOrdersRes.data) db.serviceOrders = serviceOrdersRes.data.map(mapServiceOrder);

        } catch (error) {
            console.error('Scoped Supabase fetch failed:', error);
        }

        window.dispatchEvent(new Event('tz-ready'));
    }

    // ===== Realtime Subscriptions =====
    function setupRealtime() {
        const channel = supabase.channel('tz-realtime');

        // Products
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
            if (payload.eventType === 'INSERT') {
                const exists = db.products.find(p => p.id === payload.new.id);
                if (!exists) db.products.push(mapProduct(payload.new));
            } else if (payload.eventType === 'UPDATE') {
                const idx = db.products.findIndex(p => p.id === payload.new.id);
                if (idx >= 0) db.products[idx] = mapProduct(payload.new);
                else db.products.push(mapProduct(payload.new));
            } else if (payload.eventType === 'DELETE') {
                db.products = db.products.filter(p => p.id !== payload.old.id);
            }
            fireDataUpdate('products');
        });

        // Categories
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, (payload) => {
            if (payload.eventType === 'INSERT') {
                const exists = db.categories.find(c => c.id === payload.new.id);
                if (!exists) db.categories.push(mapCategory(payload.new));
            } else if (payload.eventType === 'UPDATE') {
                const idx = db.categories.findIndex(c => c.id === payload.new.id);
                if (idx >= 0) db.categories[idx] = mapCategory(payload.new);
                else db.categories.push(mapCategory(payload.new));
            } else if (payload.eventType === 'DELETE') {
                db.categories = db.categories.filter(c => c.id !== payload.old.id);
            }
            db.categories.sort((a,b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            fireDataUpdate('categories');
        });

        // Digital Services (SMM / Topups)
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, (payload) => {
            if (payload.eventType === 'INSERT') {
                const exists = db.services.find(s => s.id === payload.new.id);
                if (!exists) db.services.push(mapDigitalService(payload.new));
            } else if (payload.eventType === 'UPDATE') {
                const idx = db.services.findIndex(s => s.id === payload.new.id);
                if (idx >= 0) db.services[idx] = mapDigitalService(payload.new);
                else db.services.push(mapDigitalService(payload.new));
            } else if (payload.eventType === 'DELETE') {
                db.services = db.services.filter(s => s.id !== payload.old.id);
            }
            fireDataUpdate('services');
        });

        // Service Orders
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'service_orders' }, (payload) => {
            if (payload.eventType === 'INSERT') {
                const exists = db.serviceOrders.find(o => o.id === payload.new.id);
                if (!exists) db.serviceOrders.unshift(mapServiceOrder(payload.new));
            } else if (payload.eventType === 'UPDATE') {
                const idx = db.serviceOrders.findIndex(o => o.id === payload.new.id);
                if (idx >= 0) db.serviceOrders[idx] = mapServiceOrder(payload.new);
                else db.serviceOrders.unshift(mapServiceOrder(payload.new));
            } else if (payload.eventType === 'DELETE') {
                db.serviceOrders = db.serviceOrders.filter(o => o.id !== payload.old.id);
            }
            fireDataUpdate('service_orders');
        });

        // Orders
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
            if (payload.eventType === 'INSERT') {
                const exists = db.orders.find(o => o.id === payload.new.id);
                if (!exists) db.orders.unshift(mapOrder(payload.new, []));
            } else if (payload.eventType === 'UPDATE') {
                const idx = db.orders.findIndex(o => o.id === payload.new.id);
                if (idx >= 0) {
                    const oldItems = db.orders[idx].items;
                    db.orders[idx] = mapOrder(payload.new, oldItems);
                }
            } else if (payload.eventType === 'DELETE') {
                db.orders = db.orders.filter(o => o.id !== payload.old.id);
            }
            fireDataUpdate('orders');
        });

        // Repair Services
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'repair_services' }, (payload) => {
            if (payload.eventType === 'INSERT') {
                const exists = db.repairServices.find(s => s.id === payload.new.id);
                if (!exists) db.repairServices.push(mapRepairService(payload.new));
            } else if (payload.eventType === 'UPDATE') {
                const idx = db.repairServices.findIndex(s => s.id === payload.new.id);
                if (idx >= 0) db.repairServices[idx] = mapRepairService(payload.new);
                else db.repairServices.push(mapRepairService(payload.new));
            } else if (payload.eventType === 'DELETE') {
                db.repairServices = db.repairServices.filter(s => s.id !== payload.old.id);
            }
            fireDataUpdate('repair_services');
        });

        // Repair Bookings (admin sees new bookings in realtime!)
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'repair_bookings' }, (payload) => {
            if (payload.eventType === 'INSERT') {
                const exists = db.repairBookings.find(b => b.id === payload.new.id);
                if (!exists) db.repairBookings.unshift(mapRepairBooking(payload.new));
            } else if (payload.eventType === 'UPDATE') {
                const idx = db.repairBookings.findIndex(b => b.id === payload.new.id);
                if (idx >= 0) db.repairBookings[idx] = mapRepairBooking(payload.new);
            } else if (payload.eventType === 'DELETE') {
                db.repairBookings = db.repairBookings.filter(b => b.id !== payload.old.id);
            }
            fireDataUpdate('repair_bookings');
        });

        // Contact Messages
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'contact_messages' }, (payload) => {
            if (payload.eventType === 'INSERT') {
                const exists = db.contactMessages.find(m => m.id === payload.new.id);
                if (!exists) db.contactMessages.unshift(mapContactMessage(payload.new));
            } else if (payload.eventType === 'UPDATE') {
                const idx = db.contactMessages.findIndex(m => m.id === payload.new.id);
                if (idx >= 0) db.contactMessages[idx] = mapContactMessage(payload.new);
            } else if (payload.eventType === 'DELETE') {
                db.contactMessages = db.contactMessages.filter(m => m.id !== payload.old.id);
            }
            fireDataUpdate('contact_messages');
        });

        // Deposits
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'deposits' }, (payload) => {
            if (payload.eventType === 'INSERT') {
                const exists = db.deposits.find(d => d.id === payload.new.id);
                if (!exists) db.deposits.unshift({ ...payload.new, amount: parseFloat(payload.new.amount || 0) });
            } else if (payload.eventType === 'UPDATE') {
                const idx = db.deposits.findIndex(d => d.id === payload.new.id);
                const mapped = { ...payload.new, amount: parseFloat(payload.new.amount || 0) };
                if (idx >= 0) db.deposits[idx] = mapped;
                else db.deposits.unshift(mapped);
            } else if (payload.eventType === 'DELETE') {
                db.deposits = db.deposits.filter(d => d.id !== payload.old.id);
            }
            fireDataUpdate('deposits');
        });

        // Coupons
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' }, (payload) => {
            if (payload.eventType === 'INSERT') {
                const exists = db.coupons.find(c => c.id === payload.new.id);
                if (!exists) db.coupons.push(mapCoupon(payload.new));
            } else if (payload.eventType === 'UPDATE') {
                const idx = db.coupons.findIndex(c => c.id === payload.new.id);
                if (idx >= 0) db.coupons[idx] = mapCoupon(payload.new);
            } else if (payload.eventType === 'DELETE') {
                db.coupons = db.coupons.filter(c => c.id !== payload.old.id);
            }
            fireDataUpdate('coupons');
        });

        // Settings
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
            if (payload.new && payload.new.data) {
                db.settings = { ...db.settings, ...payload.new.data };
            }
            fireDataUpdate('settings');
        });

        channel.subscribe(() => {});
    }

    function fireDataUpdate(table) {
        window.dispatchEvent(new CustomEvent('tz-data-updated', { detail: { table } }));
    }

    function setupScopedRealtime() {
        const config = getDataScopeConfig();
        const realtimeTables = new Set(config.realtime);
        if (realtimeTables.size === 0) {
            return;
        }

        const channel = supabase.channel(`tz-realtime-${DATA_SCOPE}`);

        if (realtimeTables.has('products')) {
            channel.on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const exists = db.products.find(p => p.id === payload.new.id);
                    if (!exists) db.products.push(mapProduct(payload.new));
                } else if (payload.eventType === 'UPDATE') {
                    const idx = db.products.findIndex(p => p.id === payload.new.id);
                    if (idx >= 0) db.products[idx] = mapProduct(payload.new);
                    else db.products.push(mapProduct(payload.new));
                } else if (payload.eventType === 'DELETE') {
                    db.products = db.products.filter(p => p.id !== payload.old.id);
                }
                fireDataUpdate('products');
            });
        }

        if (realtimeTables.has('categories')) {
            channel.on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const exists = db.categories.find(c => c.id === payload.new.id);
                    if (!exists) db.categories.push(mapCategory(payload.new));
                } else if (payload.eventType === 'UPDATE') {
                    const idx = db.categories.findIndex(c => c.id === payload.new.id);
                    if (idx >= 0) db.categories[idx] = mapCategory(payload.new);
                    else db.categories.push(mapCategory(payload.new));
                } else if (payload.eventType === 'DELETE') {
                    db.categories = db.categories.filter(c => c.id !== payload.old.id);
                }
                db.categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                fireDataUpdate('categories');
            });
        }

        if (realtimeTables.has('services')) {
            channel.on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const exists = db.services.find(s => s.id === payload.new.id);
                    if (!exists) db.services.push(mapDigitalService(payload.new));
                } else if (payload.eventType === 'UPDATE') {
                    const idx = db.services.findIndex(s => s.id === payload.new.id);
                    if (idx >= 0) db.services[idx] = mapDigitalService(payload.new);
                    else db.services.push(mapDigitalService(payload.new));
                } else if (payload.eventType === 'DELETE') {
                    db.services = db.services.filter(s => s.id !== payload.old.id);
                }
                fireDataUpdate('services');
            });
        }

        if (realtimeTables.has('service_orders')) {
            channel.on('postgres_changes', { event: '*', schema: 'public', table: 'service_orders' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const exists = db.serviceOrders.find(order => order.id === payload.new.id);
                    if (!exists) db.serviceOrders.unshift(mapServiceOrder(payload.new));
                } else if (payload.eventType === 'UPDATE') {
                    const idx = db.serviceOrders.findIndex(order => order.id === payload.new.id);
                    if (idx >= 0) db.serviceOrders[idx] = mapServiceOrder(payload.new);
                    else db.serviceOrders.unshift(mapServiceOrder(payload.new));
                } else if (payload.eventType === 'DELETE') {
                    db.serviceOrders = db.serviceOrders.filter(order => order.id !== payload.old.id);
                }
                fireDataUpdate('service_orders');
            });
        }

        if (realtimeTables.has('orders')) {
            channel.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const exists = db.orders.find(order => order.id === payload.new.id);
                    if (!exists) db.orders.unshift(mapOrder(payload.new, []));
                } else if (payload.eventType === 'UPDATE') {
                    const idx = db.orders.findIndex(order => order.id === payload.new.id);
                    if (idx >= 0) {
                        const oldItems = db.orders[idx].items;
                        db.orders[idx] = mapOrder(payload.new, oldItems);
                    }
                } else if (payload.eventType === 'DELETE') {
                    db.orders = db.orders.filter(order => order.id !== payload.old.id);
                }
                fireDataUpdate('orders');
            });
        }

        if (realtimeTables.has('repair_services')) {
            channel.on('postgres_changes', { event: '*', schema: 'public', table: 'repair_services' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const exists = db.repairServices.find(service => service.id === payload.new.id);
                    if (!exists) db.repairServices.push(mapRepairService(payload.new));
                } else if (payload.eventType === 'UPDATE') {
                    const idx = db.repairServices.findIndex(service => service.id === payload.new.id);
                    if (idx >= 0) db.repairServices[idx] = mapRepairService(payload.new);
                    else db.repairServices.push(mapRepairService(payload.new));
                } else if (payload.eventType === 'DELETE') {
                    db.repairServices = db.repairServices.filter(service => service.id !== payload.old.id);
                }
                fireDataUpdate('repair_services');
            });
        }

        if (realtimeTables.has('repair_bookings')) {
            channel.on('postgres_changes', { event: '*', schema: 'public', table: 'repair_bookings' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const exists = db.repairBookings.find(booking => booking.id === payload.new.id);
                    if (!exists) db.repairBookings.unshift(mapRepairBooking(payload.new));
                } else if (payload.eventType === 'UPDATE') {
                    const idx = db.repairBookings.findIndex(booking => booking.id === payload.new.id);
                    if (idx >= 0) db.repairBookings[idx] = mapRepairBooking(payload.new);
                } else if (payload.eventType === 'DELETE') {
                    db.repairBookings = db.repairBookings.filter(booking => booking.id !== payload.old.id);
                }
                fireDataUpdate('repair_bookings');
            });
        }

        if (realtimeTables.has('contact_messages')) {
            channel.on('postgres_changes', { event: '*', schema: 'public', table: 'contact_messages' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const exists = db.contactMessages.find(message => message.id === payload.new.id);
                    if (!exists) db.contactMessages.unshift(mapContactMessage(payload.new));
                } else if (payload.eventType === 'UPDATE') {
                    const idx = db.contactMessages.findIndex(message => message.id === payload.new.id);
                    if (idx >= 0) db.contactMessages[idx] = mapContactMessage(payload.new);
                } else if (payload.eventType === 'DELETE') {
                    db.contactMessages = db.contactMessages.filter(message => message.id !== payload.old.id);
                }
                fireDataUpdate('contact_messages');
            });
        }

        if (realtimeTables.has('deposits')) {
            channel.on('postgres_changes', { event: '*', schema: 'public', table: 'deposits' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const exists = db.deposits.find(deposit => deposit.id === payload.new.id);
                    if (!exists) db.deposits.unshift({ ...payload.new, amount: parseFloat(payload.new.amount || 0) });
                } else if (payload.eventType === 'UPDATE') {
                    const idx = db.deposits.findIndex(deposit => deposit.id === payload.new.id);
                    const mapped = { ...payload.new, amount: parseFloat(payload.new.amount || 0) };
                    if (idx >= 0) db.deposits[idx] = mapped;
                    else db.deposits.unshift(mapped);
                } else if (payload.eventType === 'DELETE') {
                    db.deposits = db.deposits.filter(deposit => deposit.id !== payload.old.id);
                }
                fireDataUpdate('deposits');
            });
        }

        if (realtimeTables.has('coupons')) {
            channel.on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const exists = db.coupons.find(coupon => coupon.id === payload.new.id);
                    if (!exists) db.coupons.push(mapCoupon(payload.new));
                } else if (payload.eventType === 'UPDATE') {
                    const idx = db.coupons.findIndex(coupon => coupon.id === payload.new.id);
                    if (idx >= 0) db.coupons[idx] = mapCoupon(payload.new);
                } else if (payload.eventType === 'DELETE') {
                    db.coupons = db.coupons.filter(coupon => coupon.id !== payload.old.id);
                }
                fireDataUpdate('coupons');
            });
        }

        if (realtimeTables.has('settings')) {
            channel.on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
                if (payload.new && payload.new.data) {
                    db.settings = { ...db.settings, ...payload.new.data };
                }
                fireDataUpdate('settings');
            });
        }

        channel.subscribe(() => {});
    }

    // ===== Sync Functions (Push to Supabase) =====
    function commitLog(action, actorId, details) {
        const log = { id: generateId('log-'), action, actorId, details, timestamp: nowIso() };
        db.logs.unshift(log);
        if (!LEGACY_ADMIN_WRITE_ENABLED) {
            return;
        }
        supabase.from('audit_logs').insert([{
            id: log.id, action: log.action,
            actor_id: log.actorId, details: log.details
        }]).then(({ error }) => { if (error) console.error('Log sync error:', error); });
    }

    function syncProduct(p) {
        supabase.from('products').upsert([{
            id: p.id, name: p.name, category_id: p.categoryId, brand: p.brand,
            product_type: p.productType || 'physical',
            price: p.price, discount_price: p.discountPrice, quantity: p.quantity,
            rating: p.rating, sold: p.sold, status: p.status, description: p.description,
            specs: p.specs, images: p.images, variants: p.variants,
            low_stock_alert: p.lowStockAlert, updated_at: nowIso()
        }]).then(({ error }) => { if (error) console.error('Product sync error:', error); });
    }

    function syncOrder(o) {
        supabase.from('orders').upsert([{
            id: o.id, user_id: o.userId || null, customer_name: o.customerName,
            customer_phone: o.customerPhone, customer_email: o.customerEmail,
            total: o.total, status: o.status, delivery_method: o.deliveryMethod || null,
            payment_method: o.paymentMethod || null, shipping_fee: o.shippingFee || 0,
            notes: o.notes || null
        }]).then(({ error }) => { if (error) console.error('Order sync error:', error); });
    }

    function syncOrderItems(orderId, items) {
        // Delete old items and insert new
        supabase.from('order_items').delete().eq('order_id', orderId).then(() => {
            if (items && items.length > 0) {
                const rows = items.map(item => ({
                    order_id: orderId, product_id: item.productId,
                    product_name: item.productName || '', qty: item.qty, price: item.price
                }));
                supabase.from('order_items').insert(rows).then(({ error }) => {
                    if (error) console.error('Order items sync error:', error);
                });
            }
        });
    }

    function syncCategory(c) {
        supabase.from('categories').upsert([{
            id: c.id, name: c.name, icon: c.icon, parent_id: c.parentId, image: c.image,
            description: c.description || null,
            status: c.status || 'active',
            sort_order: c.sortOrder || 0,
            slug: c.slug || null,
            updated_at: nowIso()
        }]).then(({ error }) => { if (error) console.error('Category sync error:', error); });
    }
    
    function syncDigitalService(s) {
        supabase.from('services').upsert([{
            id: s.id, name: s.name, category_id: s.categoryId || null, provider_service_id: s.providerServiceId || null,
            subcategory_id: s.subcategoryId || s.categoryId || null,
            price: s.price, cost_price: s.costPrice || 0, min_qty: s.minQty || 1, max_qty: s.maxQty || 1000,
            description: s.description || null, speed: s.speed || null, guarantee: s.guarantee || null,
            image: s.image || null, status: s.status || 'active',
            sort_order: s.sortOrder || 0, slug: s.slug || null, updated_at: nowIso()
        }]).then(({ error }) => { if (error) console.error('Digital Service sync error:', error); });
    }

    function syncCoupon(c) {
        supabase.from('coupons').upsert([{
            id: c.id, code: c.code, type: c.type, value: c.value,
            min_order: c.minOrder, max_uses: c.maxUses, used_count: c.usedCount,
            status: c.status, expires_at: c.expiresAt, created_at: c.createdAt || nowIso()
        }]).then(({ error }) => { if (error) console.error('Coupon sync error:', error); });
    }

    function syncRepairService(s) {
        supabase.from('repair_services').upsert([{
            id: s.id, name: s.name, category: s.category, description: s.description,
            price: s.price, duration: s.duration, icon: s.icon, image: s.image || '',
            status: s.status, created_at: s.createdAt || nowIso()
        }]).then(({ error }) => { if (error) console.error('Repair service sync error:', error); });
    }

    function syncRepairBooking(r) {
        supabase.from('repair_bookings').upsert([{
            id: r.id, name: r.name, phone: r.phone, email: r.email,
            service_id: r.serviceId, service_name: r.serviceName, device: r.device,
            description: r.description, preferred_date: r.preferredDate, mode: r.mode,
            address: r.address || '', status: r.status, created_at: r.createdAt || nowIso()
        }]).then(({ error }) => { if (error) console.error('Repair booking sync error:', error); });
    }

    function syncContactMessage(m) {
        supabase.from('contact_messages').upsert([{
            id: m.id, name: m.name, email: m.email, phone: m.phone,
            service_type: m.serviceType, message: m.message, status: m.status,
            created_at: m.createdAt || nowIso()
        }]).then(({ error }) => { if (error) console.error('Contact message sync error:', error); });
    }

    function syncUser(u) {
        supabase.from('app_users').upsert([{
            id: u.id, full_name: u.fullName, email: u.email, phone: u.phone,
            role: u.role, status: u.status, password_hash: u.passwordHash,
            created_at: u.createdAt || nowIso()
        }]).then(({ error }) => { if (error) console.error('User sync error:', error); });
    }

    function syncSettings(settingsData) {
        supabase.from('settings').upsert([{ id: 1, data: settingsData }])
            .then(({ error }) => { if (error) console.error('Settings sync error:', error); });
    }

    function syncDelete(table, id) {
        supabase.from(table).delete().eq('id', id)
            .then(({ error }) => { if (error) console.error(`Delete sync error (${table}):`, error); });
    }


    function syncCoupon(c) {
        supabase.from('coupons').upsert([{
            id: c.id, code: c.code, type: c.type, value: c.value,
            min_order: c.minOrder, max_uses: c.maxUses, used_count: c.usedCount,
            status: c.status, expires_at: c.expiresAt, created_at: c.createdAt || nowIso()
        }]).then(({ error }) => { if (error) console.error('Coupon sync error:', error); });
    }

    function syncRepairService(s) {
        supabase.from('repair_services').upsert([{
            id: s.id, name: s.name, category: s.category, description: s.description,
            price: s.price, duration: s.duration, icon: s.icon, image: s.image || '',
            status: s.status, created_at: s.createdAt || nowIso()
        }]).then(({ error }) => { if (error) console.error('Repair service sync error:', error); });
    }

    function syncRepairBooking(r) {
        supabase.from('repair_bookings').upsert([{
            id: r.id, name: r.name, phone: r.phone, email: r.email,
            service_id: r.serviceId, service_name: r.serviceName, device: r.device,
            description: r.description, preferred_date: r.preferredDate, mode: r.mode,
            address: r.address || '', status: r.status, created_at: r.createdAt || nowIso()
        }]).then(({ error }) => { if (error) console.error('Repair booking sync error:', error); });
    }

    function syncContactMessage(m) {
        supabase.from('contact_messages').upsert([{
            id: m.id, name: m.name, email: m.email, phone: m.phone,
            service_type: m.serviceType, message: m.message, status: m.status,
            created_at: m.createdAt || nowIso()
        }]).then(({ error }) => { if (error) console.error('Contact message sync error:', error); });
    }

    function syncUser(u) {
        supabase.from('app_users').upsert([{
            id: u.id, full_name: u.fullName, email: u.email, phone: u.phone,
            role: u.role, status: u.status, password_hash: u.passwordHash,
            created_at: u.createdAt || nowIso()
        }]).then(({ error }) => { if (error) console.error('User sync error:', error); });
    }

    function syncSettings(settingsData) {
        supabase.from('settings').upsert([{ id: 1, data: settingsData }])
            .then(({ error }) => { if (error) console.error('Settings sync error:', error); });
    }

    function syncDelete(table, id) {
        supabase.from(table).delete().eq('id', id)
            .then(({ error }) => { if (error) console.error(`Delete sync error (${table}):`, error); });
    }

    function saveDbLocal() {
        localStorage.setItem('tz_cart', JSON.stringify(db.cart));
    }

    // ===== Data Access =====
    function getCategoryName(id) {
        if (!id) return 'إكسسوار / مستقل';
        const c = db.categories.find(x => x.id === id);
        return c ? c.name : id;
    }

    function getCategoryIcon(id) {
        if (!id) return 'fa-box';
        const c = db.categories.find(x => x.id === id);
        return c && c.icon ? c.icon : 'fa-box';
    }

    function getProductById(id) {
        return db.products.find(x => x.id === id);
    }

    function getUserById(id) {
        return db.users.find(x => x.id === id);
    }

    function findUserByAuthUser(authUser) {
        if (!authUser) return null;
        return db.users.find((user) =>
            user.authUserId === authUser.id ||
            (user.email && authUser.email && user.email.toLowerCase() === authUser.email.toLowerCase())
        ) || null;
    }

    function isCustomerUser(user) {
        if (!user) return false;
        return !['admin', 'super_admin', 'employee', 'technician'].includes(user.role);
    }

    function canAccessAdmin(user) {
        if (!user || user.status !== 'active') return false;
        const r = ROLES[user.role];
        return r && r.level >= 3;
    }

    function canAccessSection(user, sectionId) {
        if (!user || user.status !== 'active') return false;
        const r = ROLES[user.role];
        const sec = ADMIN_SECTIONS.find(s => s.id === sectionId);
        if (!r || !sec) return false;
        return r.level >= sec.minLevel;
    }

    function getFilteredProducts(filters) {
        let res = db.products.filter(p => p.status === 'active');
        if (filters.categoryId) res = res.filter(p => p.categoryId === filters.categoryId);
        if (filters.brand) res = res.filter(p => p.brand === filters.brand);
        if (filters.minPrice > 0) res = res.filter(p => (p.discountPrice || p.price) >= filters.minPrice);
        if (filters.maxPrice > 0) res = res.filter(p => (p.discountPrice || p.price) <= filters.maxPrice);
        if (filters.rating > 0) res = res.filter(p => p.rating >= filters.rating);
        if (filters.q) {
            const q = filters.q.toLowerCase();
            res = res.filter(p => p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q)) || (p.description && p.description.toLowerCase().includes(q)));
        }
        if (filters.sort) {
            if (filters.sort === 'bestselling') res.sort((a, b) => b.sold - a.sold);
            else if (filters.sort === 'newest') res.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            else if (filters.sort === 'price_asc') res.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price));
            else if (filters.sort === 'price_desc') res.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price));
            else if (filters.sort === 'rating') res.sort((a, b) => b.rating - a.rating);
        }
        return res;
    }

    function getFeaturedProducts(limit = 8) {
        return db.products.filter(p => p.status === 'active').sort((a, b) => b.sold - a.sold).slice(0, limit);
    }

    function getLatestProducts(limit = 8) {
        return db.products.filter(p => p.status === 'active').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
    }

    function getBrands() {
        const brands = new Set();
        db.products.forEach(p => { if (p.brand) brands.add(p.brand); });
        return Array.from(brands).sort();
    }

    function getCategoryName(id) {
        if (!id || isAccessoryProductCategoryId(id)) return ACCESSORY_PUBLIC_LABEL;
        if (id === ACCESSORY_MAIN_CATEGORY_ID) return ACCESSORY_SECTION_NAME;
        const c = db.categories.find(x => x.id === id);
        return c ? c.name : id;
    }

    function getCategoryIcon(id) {
        if (!id || isAccessoryCatalogCategoryId(id)) return 'fa-headphones';
        const c = db.categories.find(x => x.id === id);
        return c && c.icon ? c.icon : 'fa-box';
    }

    function getFilteredProducts(filters) {
        let res = getCatalogProducts();
        if (filters.categoryId) res = res.filter(p => p.categoryId === filters.categoryId);
        if (filters.brand) res = res.filter(p => p.brand === filters.brand);
        if (filters.minPrice > 0) res = res.filter(p => (p.discountPrice || p.price) >= filters.minPrice);
        if (filters.maxPrice > 0) res = res.filter(p => (p.discountPrice || p.price) <= filters.maxPrice);
        if (filters.rating > 0) res = res.filter(p => p.rating >= filters.rating);
        if (filters.q) {
            const q = filters.q.toLowerCase();
            res = res.filter(p => p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q)) || (p.description && p.description.toLowerCase().includes(q)));
        }
        if (filters.sort) {
            if (filters.sort === 'bestselling') res.sort((a, b) => b.sold - a.sold);
            else if (filters.sort === 'newest') res.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            else if (filters.sort === 'price_asc') res.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price));
            else if (filters.sort === 'price_desc') res.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price));
            else if (filters.sort === 'rating') res.sort((a, b) => b.rating - a.rating);
        }
        return res;
    }

    function getFeaturedProducts(limit = 8) {
        return getCatalogProducts().sort((a, b) => b.sold - a.sold).slice(0, limit);
    }

    function getLatestProducts(limit = 8) {
        return getCatalogProducts().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
    }

    function getBrands() {
        const brands = new Set();
        getCatalogProducts().forEach(p => { if (p.brand) brands.add(p.brand); });
        return Array.from(brands).sort();
    }

    function getActiveRepairServices() {
        return db.repairServices.filter(s => s.status === 'active');
    }

    // ===== Cart =====
    function addToCart(productId, qty) {
        qty = parseInt(qty) || 1;
        const p = getProductById(productId);
        if (!p || p.quantity < qty) return;
        const existing = db.cart.find(c => c.productId === productId);
        if (existing) { existing.qty += qty; } else { db.cart.push({ productId, qty }); }
        saveDbLocal();
        if (typeof window.TZ.onCartChange === 'function') window.TZ.onCartChange();
    }

    function removeFromCart(productId) {
        db.cart = db.cart.filter(c => c.productId !== productId);
        saveDbLocal();
        if (typeof window.TZ.onCartChange === 'function') window.TZ.onCartChange();
    }

    function getCartTotal() {
        return db.cart.reduce((sum, item) => {
            const p = getProductById(item.productId);
            if (!p) return sum;
            return sum + (p.discountPrice || p.price) * item.qty;
        }, 0);
    }

    function getCartCount() {
        return db.cart.reduce((sum, item) => sum + item.qty, 0);
    }

    // ===== Commit DB (main sync entry point) =====
    function commitDb(action, actorId, details, resource) {
        commitLog(action, actorId, details);
        if (!LEGACY_ADMIN_WRITE_ENABLED) {
            console.warn('Legacy admin write skipped (read-only mode). Migrate this action to Next.js API routes.', action);
            return;
        }
        if (resource) {
            switch (resource.type) {
                case 'product': syncProduct(resource.data); break;
                case 'product_delete': syncDelete('products', resource.data.id); break;
                case 'order': syncOrder(resource.data); break;
                case 'order_items': syncOrderItems(resource.data.orderId, resource.data.items); break;
                case 'category': syncCategory(resource.data); break;
                case 'category_delete': syncDelete('categories', resource.data.id); break;
                case 'service':
                case 'digital_service': syncDigitalService(resource.data); break;
                case 'service_delete':
                case 'digital_service_delete': syncDelete('services', resource.data.id); break;
                case 'settings_update': syncSettings(resource.data); break;
                case 'coupon': syncCoupon(resource.data); break;
                case 'coupon_delete': syncDelete('coupons', resource.data.id); break;
                case 'repair_service': syncRepairService(resource.data); break;
                case 'repair_service_delete': syncDelete('repair_services', resource.data.id); break;
                case 'repair_booking': syncRepairBooking(resource.data); break;
                case 'repair_booking_delete': syncDelete('repair_bookings', resource.data.id); break;
                case 'contact_message': syncContactMessage(resource.data); break;
                case 'contact_message_delete': syncDelete('contact_messages', resource.data.id); break;
                case 'user': syncUser(resource.data); break;
                case 'user_delete': syncDelete('app_users', resource.data.id); break;
            }
        }
    }

    // ===== Refresh (force reload from Supabase) =====
    async function refreshData() {
        await loadDataFromSupabaseByScope();
        fireDataUpdate('all');
    }

    // ===== Initialize =====
    loadDataFromSupabaseByScope().then(() => {
        setupScopedRealtime();
    });

    // ===== Public API =====
    window.TZ = {
        db: db,
        supabase: supabase,
        saveDb: saveDbLocal,
        commitDb: commitDb,
        refreshData: refreshData,

        // Utilities
        generateId, nowIso, clone, escapeHtml, formatPrice,

        // Supabase Auth
        supabaseSignIn, supabaseSignOut, getSupabaseUser,

        // Session (legacy)
        getSession, setSession, clearSession,

        // Data access
        getCategoryName, getCategoryIcon, getProductById, getUserById, findUserByAuthUser, isCustomerUser,
        getFilteredProducts, getFeaturedProducts, getLatestProducts, getBrands,
        getVisibleCatalogCategories, getCatalogProducts, getAccessoryProducts,
        isAccessoryCatalogCategoryId, isAccessoryProductCategoryId, isAccessoryProduct,
        getActiveRepairServices,

        // RBAC
        ROLES, ADMIN_SECTIONS, canAccessAdmin, canAccessSection,

        accessoryCatalog: {
            sectionName: ACCESSORY_SECTION_NAME,
            publicLabel: ACCESSORY_PUBLIC_LABEL,
            mainCategoryId: ACCESSORY_MAIN_CATEGORY_ID,
            subcategoryId: ACCESSORY_SUBCATEGORY_ID,
            mainCategorySeed: clone(ACCESSORY_MAIN_CATEGORY),
            subcategorySeed: clone(ACCESSORY_SUBCATEGORY),
            isAccessoryCatalogCategoryId,
            isAccessoryProductCategoryId,
            isAccessoryProduct
        },

        // Cart
        addToCart, removeFromCart, getCartTotal, getCartCount,

        // Event hooks
        onCartChange: null,
        legacyWriteEnabled: LEGACY_ADMIN_WRITE_ENABLED
    };

})();
