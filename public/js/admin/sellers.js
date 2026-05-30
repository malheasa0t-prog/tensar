/**
 * TechZone Admin — Sellers Management Section
 *
 * Allows the admin to promote users to "seller" role and configure
 * per-main-category discount percentages for each seller.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    var DISCOUNTS_TABLE = 'seller_category_discounts';

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    /**
     * Returns main (root) categories from the loaded data.
     *
     * @returns {Array<{ id: string, name: string }>}
     */
    function getMainCategories() {
        return (TZ.db.categories || []).filter(function (c) {
            return !c.parentId && !c.parent_id;
        });
    }

    /**
     * Returns all users from the loaded data.
     *
     * @returns {Array}
     */
    function getAllUsers() {
        return TZ.db.users || [];
    }

    /**
     * Returns only users with the seller role.
     *
     * @returns {Array}
     */
    function getSellers() {
        return getAllUsers().filter(function (u) {
            return u.role === 'seller';
        });
    }

    /**
     * Returns non-seller, non-admin users eligible for promotion.
     *
     * @returns {Array}
     */
    function getPromotableUsers() {
        return getAllUsers().filter(function (u) {
            return u.role === 'customer' || u.role === 'user';
        });
    }

    /**
     * Loads discount records for a specific seller.
     *
     * @param {string} userId
     * @returns {Promise<Array>}
     */
    async function loadSellerDiscounts(userId) {
        var res = await TZ.supabase
            .from(DISCOUNTS_TABLE)
            .select('*')
            .eq('user_id', userId);
        return res.data || [];
    }

    /**
     * Toggles a user's seller role through the guarded admin_set_seller_role RPC.
     *
     * Role writes never go through the generic proxy (app_users is deliberately
     * not mutable that way, to block privilege escalation). The RPC refuses to
     * touch any account that is not already customer/user/seller and, on
     * demotion, clears that seller's category discounts in the same transaction.
     *
     * @param {string} userId - The app_users id (text).
     * @param {boolean} makeSeller
     * @returns {Promise<boolean>}
     */
    async function setSellerRole(userId, makeSeller) {
        var authUser = await TZ.getSupabaseUser();
        if (!authUser) {
            A.showErrorToast('SLR-300', 'انتهت الجلسة. أعد تسجيل الدخول.');
            return false;
        }

        var res = await TZ.supabase.rpc('admin_set_seller_role', {
            p_admin_user_id: authUser.id,
            p_target_app_user_id: userId,
            p_make_seller: makeSeller
        });

        if (res.error) {
            A.showErrorToast(
                makeSeller ? 'SLR-301' : 'SLR-302',
                (makeSeller ? 'فشل ترقية المستخدم إلى بائع' : 'فشل إلغاء صلاحية البائع')
                    + ': ' + String(res.error.message || '')
            );
            return false;
        }

        A.showToast(makeSeller ? 'تم ترقية المستخدم إلى بائع بنجاح' : 'تم إلغاء صلاحية البائع');
        return true;
    }

    /**
     * Promotes a user to seller role.
     *
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    function promoteToSeller(userId) {
        return setSellerRole(userId, true);
    }

    /**
     * Demotes a seller back to customer role.
     *
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    function demoteSeller(userId) {
        return setSellerRole(userId, false);
    }

    /**
     * Saves discount percentages for a seller across categories.
     *
     * @param {string} userId
     * @param {Array<{ category_id: string, discount_percent: number }>} discounts
     * @returns {Promise<boolean>}
     */
    async function saveSellerDiscounts(userId, discounts) {
        await TZ.supabase.from(DISCOUNTS_TABLE).delete().eq('user_id', userId);

        var rows = discounts
            .filter(function (d) { return Number(d.discount_percent) > 0; })
            .map(function (d) {
                return {
                    user_id: userId,
                    category_id: d.category_id,
                    discount_percent: Number(d.discount_percent)
                };
            });

        if (rows.length === 0) {
            A.showToast('تم حفظ الإعدادات (لا توجد خصومات)');
            return true;
        }

        var res = await TZ.supabase.from(DISCOUNTS_TABLE).insert(rows);
        if (res.error) {
            A.showErrorToast('SLR-303', 'فشل حفظ نسب الخصم');
            return false;
        }

        A.showToast('تم حفظ نسب الخصم بنجاح');
        return true;
    }

    /**
     * Renders the discount editor for a specific seller.
     *
     * @param {{ id: string, fullName: string }} seller
     */
    async function renderDiscountEditor(seller) {
        A.adminContent.innerHTML = '<div class="admin-section-header"><div><h2><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</h2></div></div>';

        var categories = getMainCategories();
        var existingDiscounts = await loadSellerDiscounts(seller.id);

        var discountMap = {};
        existingDiscounts.forEach(function (d) {
            discountMap[d.category_id] = d.discount_percent;
        });

        var html = '<div class="admin-section-header"><div>'
            + '<h2><i class="fas fa-user-tag"></i> خصومات البائع: ' + esc(seller.fullName || seller.email || seller.id) + '</h2>'
            + '<p>حدد نسبة الخصم لكل فئة رئيسية. النسبة تُطبق على المنتجات ضمن الفئة وفئاتها الفرعية.</p>'
            + '</div></div>';

        html += '<div class="admin-panel"><div class="panel-body padded">'
            + '<form id="discountForm" class="admin-form">';

        if (categories.length === 0) {
            html += '<div class="empty-state"><i class="fas fa-tags"></i><p>لا توجد فئات رئيسية</p></div>';
        } else {
            html += '<div style="display:grid;gap:12px;">';
            categories.forEach(function (cat) {
                var val = discountMap[cat.id] || 0;
                html += '<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);">'
                    + '<div style="flex:1;"><strong>' + esc(cat.name) + '</strong></div>'
                    + '<div style="display:flex;align-items:center;gap:8px;">'
                    + '<input type="number" min="0" max="100" step="0.5" value="' + val + '" data-cat-id="' + esc(cat.id) + '" class="disc-input" style="width:80px;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--text-primary);text-align:center;font-size:0.95rem;">'
                    + '<span style="color:var(--text-muted);">%</span>'
                    + '</div></div>';
            });
            html += '</div>';
        }

        html += '<div class="admin-form-actions" style="margin-top:1.5rem;">'
            + '<button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> حفظ الخصومات</button>'
            + '<button type="button" class="btn btn-outline" id="discBackBtn"><i class="fas fa-arrow-right"></i> رجوع</button>'
            + '</div></form></div></div>';

        A.adminContent.innerHTML = html;

        document.getElementById('discBackBtn').addEventListener('click', function () {
            renderSellers();
        });

        document.getElementById('discountForm').addEventListener('submit', async function (e) {
            e.preventDefault();
            var btn = this.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

            var discounts = [];
            document.querySelectorAll('.disc-input').forEach(function (input) {
                discounts.push({
                    category_id: input.dataset.catId,
                    discount_percent: Number(input.value) || 0
                });
            });

            var ok = await saveSellerDiscounts(seller.id, discounts);
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> حفظ الخصومات';
            if (!ok) return;
        });
    }

    /**
     * Renders the promote-user form.
     */
    function renderPromoteForm() {
        var users = getPromotableUsers();

        var html = '<div class="admin-section-header"><div>'
            + '<h2><i class="fas fa-user-plus"></i> ترقية مستخدم إلى بائع</h2>'
            + '</div></div>';

        html += '<div class="admin-panel"><div class="panel-body padded">'
            + '<form id="promoteForm" class="admin-form"><div class="form-grid">'
            + '<div class="admin-form-group full"><label>اختر المستخدم</label>'
            + '<select id="promoteUserId" required>';

        if (users.length === 0) {
            html += '<option value="">لا يوجد مستخدمون قابلون للترقية</option>';
        } else {
            html += '<option value="">— اختر مستخدم —</option>';
            users.forEach(function (u) {
                var label = (u.fullName || u.email || u.id);
                html += '<option value="' + esc(u.id) + '">' + esc(label) + '</option>';
            });
        }

        html += '</select></div></div>'
            + '<div class="admin-form-actions">'
            + '<button type="submit" class="btn btn-primary"><i class="fas fa-user-tag"></i> ترقية إلى بائع</button>'
            + '<button type="button" class="btn btn-outline" id="promoteBackBtn"><i class="fas fa-arrow-right"></i> رجوع</button>'
            + '</div></form></div></div>';

        A.adminContent.innerHTML = html;

        document.getElementById('promoteBackBtn').addEventListener('click', function () {
            renderSellers();
        });

        document.getElementById('promoteForm').addEventListener('submit', async function (e) {
            e.preventDefault();
            var userId = document.getElementById('promoteUserId').value;
            if (!userId) { A.showErrorToast('SLR-101', 'اختر مستخدماً'); return; }

            var btn = this.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الترقية...';

            var ok = await promoteToSeller(userId);
            if (ok) {
                await TZ.refreshData();
                renderSellers();
            } else {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-user-tag"></i> ترقية إلى بائع';
            }
        });
    }

    /**
     * Renders the main sellers listing.
     */
    async function renderSellers() {
        var sellers = getSellers();

        var html = '<div class="admin-section-header"><div>'
            + '<h2><i class="fas fa-store"></i> إدارة البائعين</h2>'
            + '<p>' + sellers.length + ' بائع مسجل</p>'
            + '</div><div>'
            + '<button class="btn btn-primary" id="addSellerBtn"><i class="fas fa-user-plus"></i> ترقية مستخدم</button>'
            + '</div></div>';

        if (sellers.length === 0) {
            html += '<div class="admin-panel"><div class="panel-body"><div class="empty-state">'
                + '<i class="fas fa-user-tag"></i><p>لا يوجد بائعون بعد. قم بترقية مستخدم للبدء.</p>'
                + '</div></div></div>';
        } else {
            html += '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
                + '<th>البائع</th><th>البريد</th><th>الهاتف</th><th>التاريخ</th><th style="width:160px;">إجراءات</th>'
                + '</tr></thead><tbody>';

            sellers.forEach(function (u) {
                html += '<tr>'
                    + '<td><strong>' + esc(u.fullName || u.email || u.id) + '</strong>'
                    + '<br><span class="status-badge" style="background:rgba(108,92,231,0.1);color:#6c5ce7;">بائع</span></td>'
                    + '<td><small>' + esc(u.email || '-') + '</small></td>'
                    + '<td><small>' + esc(u.phone || '-') + '</small></td>'
                    + '<td><small style="color:var(--text-muted);">' + (u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-JO') : '-') + '</small></td>'
                    + '<td><div style="display:flex;gap:6px;">'
                    + '<button class="btn btn-icon edit-disc-btn" data-uid="' + esc(u.id) + '" title="تعديل الخصومات" style="color:#6c5ce7;background:rgba(108,92,231,0.1);border:none;padding:6px 10px;border-radius:6px;cursor:pointer;"><i class="fas fa-percent"></i></button>'
                    + '<button class="btn btn-icon demote-btn" data-uid="' + esc(u.id) + '" data-name="' + esc(u.fullName || '') + '" title="إلغاء البائع" style="color:#ff7675;background:rgba(255,118,117,0.1);border:none;padding:6px 10px;border-radius:6px;cursor:pointer;"><i class="fas fa-user-minus"></i></button>'
                    + '</div></td></tr>';
            });

            html += '</tbody></table></div></div></div>';
        }

        A.adminContent.innerHTML = html;

        document.getElementById('addSellerBtn')?.addEventListener('click', function () {
            renderPromoteForm();
        });

        document.querySelectorAll('.edit-disc-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var uid = this.dataset.uid;
                var seller = sellers.find(function (s) { return s.id === uid; });
                if (seller) renderDiscountEditor(seller);
            });
        });

        document.querySelectorAll('.demote-btn').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var uid = this.dataset.uid;
                var name = this.dataset.name || 'البائع';
                if (!window.confirm('هل تريد إلغاء صلاحية البائع لـ "' + name + '"؟ سيتم حذف جميع نسب الخصم المرتبطة.')) return;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                var ok = await demoteSeller(uid);
                if (ok) {
                    await TZ.refreshData();
                    renderSellers();
                } else {
                    this.innerHTML = '<i class="fas fa-user-minus"></i>';
                }
            });
        });
    }

    A.sections.sellers = renderSellers;
})();
