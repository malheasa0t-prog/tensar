// ===== TechZone Admin - Customers =====
(function () {
    'use strict';

    const A = window.AdminApp;

    function money(value) {
        return TZ.formatPrice(Number(value || 0));
    }

    function matchCustomer(customer, query) {
        const haystack = [
            customer.fullName,
            customer.email,
            customer.phone,
            customer.country,
            customer.id,
            customer.authUserId,
        ].join(' ').toLowerCase();
        return haystack.includes(query);
    }

    function countProductOrders(customer) {
        return (TZ.db.orders || []).filter((order) => (order.userId || order.user_id) === (customer.authUserId || customer.id)).length;
    }

    function countDigitalOrders(customer) {
        return (TZ.db.serviceOrders || []).filter((order) => (order.userId || order.user_id) === (customer.authUserId || customer.id)).length;
    }

    function countRepairBookings(customer) {
        return (TZ.db.repairBookings || []).filter((booking) => {
            const bookingUser = booking.userId || booking.user_id;
            if (bookingUser && bookingUser === (customer.authUserId || customer.id)) return true;
            if (customer.phone && booking.phone && customer.phone === booking.phone) return true;
            if (customer.email && booking.email && customer.email.toLowerCase() === booking.email.toLowerCase()) return true;
            return false;
        }).length;
    }

    async function renderCustomers() {
        const customers = TZ.db.users
            .filter((user) => TZ.isCustomerUser(user))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        A.adminContent.innerHTML = `
            <div class="admin-panel">
                <div class="panel-body" style="padding:32px;text-align:center;color:var(--text-muted);">
                    <i class="fas fa-spinner fa-spin" style="font-size:1.5rem;margin-bottom:12px;display:block;"></i>
                    جاري تحميل بيانات العملاء...
                </div>
            </div>
        `;

        const { data: wallets, error: walletError } = await TZ.supabase
            .from('wallets')
            .select('user_id,balance,reserved,total_deposited,total_spent,updated_at');

        const walletMap = new Map((wallets || []).map((wallet) => [wallet.user_id, wallet]));

        const customerRecords = customers.map((customer) => {
            const userId = customer.authUserId || customer.id;
            const wallet = walletMap.get(userId) || null;
            const deposits = (TZ.db.deposits || []).filter((deposit) => (deposit.userId || deposit.user_id) === userId);
            return {
                ...customer,
                wallet,
                productOrders: countProductOrders(customer),
                digitalOrders: countDigitalOrders(customer),
                repairBookings: countRepairBookings(customer),
                depositsCount: deposits.length,
                depositsApproved: deposits.filter((deposit) => deposit.status === 'approved').length,
            };
        });

        const totals = {
            total: customerRecords.length,
            active: customerRecords.filter((customer) => customer.status === 'active').length,
            withPhone: customerRecords.filter((customer) => customer.phone).length,
            walletHolders: customerRecords.filter((customer) => customer.wallet).length,
        };

        A.adminContent.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card-admin">
                    <div class="stat-icon blue"><i class="fas fa-users"></i></div>
                    <div class="stat-info"><h3>${totals.total}</h3><p>إجمالي العملاء</p></div>
                </div>
                <div class="stat-card-admin">
                    <div class="stat-icon green"><i class="fas fa-user-check"></i></div>
                    <div class="stat-info"><h3>${totals.active}</h3><p>عملاء نشطون</p></div>
                </div>
                <div class="stat-card-admin">
                    <div class="stat-icon purple"><i class="fas fa-phone"></i></div>
                    <div class="stat-info"><h3>${totals.withPhone}</h3><p>لديهم رقم هاتف</p></div>
                </div>
                <div class="stat-card-admin">
                    <div class="stat-icon orange"><i class="fas fa-wallet"></i></div>
                    <div class="stat-info"><h3>${totals.walletHolders}</h3><p>محافظ مفعلة</p></div>
                </div>
            </div>

            ${walletError ? `
                <div class="admin-panel" style="margin-bottom:18px;">
                    <div class="panel-body" style="color:#e67e22;">
                        تعذر تحميل بعض بيانات المحافظ، لكن بقية معلومات العملاء متاحة.
                    </div>
                </div>
            ` : ''}

            <div class="filter-bar">
                <input type="text" id="customerSearch" placeholder="بحث بالاسم أو الهاتف أو البريد أو الدولة..." style="flex:1;min-width:240px;">
                <select id="customerStatusFilter">
                    <option value="">كل الحالات</option>
                    <option value="active">نشط</option>
                    <option value="banned">محظور</option>
                </select>
            </div>

            <div id="customersCards" style="display:grid;gap:16px;"></div>
        `;

        function renderCards() {
            const query = (document.getElementById('customerSearch').value || '').trim().toLowerCase();
            const status = document.getElementById('customerStatusFilter').value;
            const filtered = customerRecords.filter((customer) => {
                const matchesQuery = !query || matchCustomer(customer, query);
                const matchesStatus = !status || customer.status === status;
                return matchesQuery && matchesStatus;
            });

            const cardsRoot = document.getElementById('customersCards');
            if (!cardsRoot) return;

            cardsRoot.innerHTML = filtered.length === 0 ? `
                <div class="admin-panel">
                    <div class="panel-body">
                        <div class="empty-state" style="padding:26px;">
                            <i class="fas fa-user-slash"></i>
                            <p>لا يوجد عملاء مطابقون لنتيجة البحث الحالية.</p>
                        </div>
                    </div>
                </div>
            ` : filtered.map((customer) => `
                <div class="admin-panel">
                    <div class="panel-body" style="display:grid;gap:14px;">
                        <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start;">
                            <div>
                                <h3 style="margin:0 0 6px 0;">${TZ.escapeHtml(customer.fullName || 'مستخدم')}</h3>
                                <div style="display:flex;gap:14px;flex-wrap:wrap;color:var(--text-muted);font-size:.9rem;">
                                    <span><i class="fas fa-id-badge"></i> ${TZ.escapeHtml(String(customer.authUserId || customer.id || '-'))}</span>
                                    <span><i class="fas fa-calendar"></i> ${customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('ar-JO') : 'غير متاح'}</span>
                                </div>
                            </div>
                            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                <span class="status-badge ${customer.status === 'active' ? 'active' : 'hidden'}">${customer.status === 'active' ? 'نشط' : 'محظور'}</span>
                                <span class="status-badge pending">${TZ.escapeHtml(customer.role || 'user')}</span>
                            </div>
                        </div>

                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
                            <div style="padding:14px;border:1px solid var(--border-color);border-radius:14px;background:var(--bg-lighter);display:grid;gap:6px;">
                                <strong>بيانات التواصل</strong>
                                <div>البريد: <span style="color:var(--text-muted)">${TZ.escapeHtml(customer.email || 'غير متاح من نظام المصادقة')}</span></div>
                                <div>الهاتف: <span style="color:var(--text-muted)">${TZ.escapeHtml(customer.phone || 'غير مضاف')}</span></div>
                                <div>الدولة: <span style="color:var(--text-muted)">${TZ.escapeHtml(customer.country || 'غير مضافة')}</span></div>
                            </div>

                            <div style="padding:14px;border:1px solid var(--border-color);border-radius:14px;background:var(--bg-lighter);display:grid;gap:6px;">
                                <strong>المحفظة</strong>
                                <div>الرصيد: <span style="color:var(--primary);font-weight:700;">${customer.wallet ? money(customer.wallet.balance) : 'غير متاح'}</span></div>
                                <div>إجمالي الشحن: <span style="color:var(--text-muted)">${customer.wallet ? money(customer.wallet.total_deposited) : '—'}</span></div>
                                <div>إجمالي المصروف: <span style="color:var(--text-muted)">${customer.wallet ? money(customer.wallet.total_spent) : '—'}</span></div>
                            </div>

                            <div style="padding:14px;border:1px solid var(--border-color);border-radius:14px;background:var(--bg-lighter);display:grid;gap:6px;">
                                <strong>النشاط</strong>
                                <div>طلبات المنتجات: <span style="color:var(--text-muted)">${customer.productOrders}</span></div>
                                <div>الطلبات الرقمية: <span style="color:var(--text-muted)">${customer.digitalOrders}</span></div>
                                <div>حجوزات الصيانة: <span style="color:var(--text-muted)">${customer.repairBookings}</span></div>
                            </div>

                            <div style="padding:14px;border:1px solid var(--border-color);border-radius:14px;background:var(--bg-lighter);display:grid;gap:6px;">
                                <strong>تفاصيل إضافية</strong>
                                <div>طلبات الإيداع: <span style="color:var(--text-muted)">${customer.depositsCount}</span></div>
                                <div>الإيداعات الموافق عليها: <span style="color:var(--text-muted)">${customer.depositsApproved}</span></div>
                                <div>آخر تحديث للمحفظة: <span style="color:var(--text-muted)">${customer.wallet?.updated_at ? new Date(customer.wallet.updated_at).toLocaleDateString('ar-JO') : 'غير متاح'}</span></div>
                            </div>
                        </div>

                        ${customer.bio ? `
                            <div style="padding:14px;border:1px solid var(--border-color);border-radius:14px;background:var(--bg-lighter);color:var(--text-muted);">
                                <strong style="color:var(--text-color);display:block;margin-bottom:6px;">نبذة العميل</strong>
                                ${TZ.escapeHtml(customer.bio)}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('');
        }

        document.getElementById('customerSearch').addEventListener('input', renderCards);
        document.getElementById('customerStatusFilter').addEventListener('change', renderCards);
        renderCards();
    }

    A.sections.customers = renderCustomers;
})();
