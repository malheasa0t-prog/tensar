/**
 * TechZone Admin Orders Section.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    // All status maps, tab definitions, and type tokens now live in
    // `orders.constants.js` so other admin modules (exports, dashboard cards,
    // bulk actions) can read the same labels without keeping a private copy.
    // Falling back to local literals keeps this file standalone-safe for the
    // unit tests that load it without the constants script.
    var ORDER_CONSTANTS = window.AdminOrdersConstants || null;
    if (!ORDER_CONSTANTS) {
        console.warn('[orders.js] AdminOrdersConstants is missing — admin shell loaded out of order.');
    }

    var ADMIN_ORDER_STATUS_API = '/api/admin/orders/status';
    var API_PORT = window.__TZ_API_PORT || '3000';
    var CODED_ERROR_PATTERN = /^\[[A-Z]{2,4}-\d{3}\]/;
    var PAGE_SIZE = 15;
    var ORDER_NOTES_PREVIEW_LENGTH = 96;

    var ORDER_TYPES = ORDER_CONSTANTS ? ORDER_CONSTANTS.ORDER_TYPES : {
        ALL: 'all', PHYSICAL: 'physical', ACCESSORY: 'accessory', SERVICE: 'service', REPAIR: 'repair'
    };
    var TYPE_ALL = ORDER_TYPES.ALL;
    var TYPE_PHYSICAL = ORDER_TYPES.PHYSICAL;
    var TYPE_ACCESSORY = ORDER_TYPES.ACCESSORY;
    var TYPE_SERVICE = ORDER_TYPES.SERVICE;
    var TYPE_REPAIR = ORDER_TYPES.REPAIR;
    var TAB_CONFIG = ORDER_CONSTANTS ? ORDER_CONSTANTS.TAB_CONFIG : [];
    var ORDER_STATUSES = ORDER_CONSTANTS ? ORDER_CONSTANTS.ORDER_STATUSES : {};
    var TYPE_LABELS = ORDER_CONSTANTS ? ORDER_CONSTANTS.TYPE_LABELS : {};
    var PHYSICAL_STATUS_OPTIONS = ORDER_CONSTANTS ? ORDER_CONSTANTS.PHYSICAL_STATUS_OPTIONS : [];
    var SERVICE_STATUS_OPTIONS = ORDER_CONSTANTS ? ORDER_CONSTANTS.SERVICE_STATUS_OPTIONS : [];
    var REPAIR_STATUS_OPTIONS = ORDER_CONSTANTS ? ORDER_CONSTANTS.REPAIR_STATUS_OPTIONS : [];
    var PHYSICAL_STATUS_ACTION_LABELS = ORDER_CONSTANTS ? ORDER_CONSTANTS.PHYSICAL_STATUS_ACTION_LABELS : {};
    var LEGACY_PHYSICAL_STATUS_MAP = ORDER_CONSTANTS ? ORDER_CONSTANTS.LEGACY_PHYSICAL_STATUS_MAP : {};
    var activeTab = TYPE_ALL;
    var filterStatus = '';
    var searchQuery = '';
    var sortMode = 'priority';
    var currentPage = 1;
    var pendingStatusOrderIds = new Set();

    /**
     * Escapes a value before injecting it into admin HTML.
     *
     * @param {unknown} value
     * @returns {string}
     */
    function esc(value) {
        return TZ.escapeHtml(value == null ? '' : String(value));
    }

    /**
     * Truncates long table text without changing short values.
     *
     * @param {unknown} value
     * @param {number} maxLength
     * @returns {string}
     */
    function truncateText(value, maxLength) {
        var normalizedValue = String(value || '').trim();
        if (!normalizedValue || normalizedValue.length <= maxLength) return normalizedValue;
        return normalizedValue.slice(0, Math.max(0, maxLength - 3)).trim() + '...';
    }

    /**
     * Adds a stable UI-only type marker to an order row.
     *
     * @param {Record<string, unknown>} order
     * @param {string} orderType
     * @returns {Record<string, unknown>}
     */
    function withOrderType(order, orderType) {
        return Object.assign({}, order, { __orderType: orderType });
    }

    /**
     * Detects whether a product order belongs to the accessories tab.
     *
     * @param {Record<string, unknown>} order
     * @returns {boolean}
     */
    function isAccessoryOrder(order) {
        return typeof TZ.isAccessoryProduct === 'function' && (order.items || []).some(function (item) {
            var categoryId = item.snapshot?.category_id || item.snapshot?.categoryId || '';
            return TZ.isAccessoryProductCategoryId ? TZ.isAccessoryProductCategoryId(categoryId) : false;
        });
    }

    /**
     * Returns local product orders for one product tab.
     *
     * @param {string} tabKey
     * @returns {Array<Record<string, unknown>>}
     */
    function getProductOrdersForTab(tabKey) {
        return (TZ.db.orders || []).filter(function (order) {
            var isAccessory = isAccessoryOrder(order);
            if (tabKey === TYPE_ACCESSORY) return isAccessory;
            if (tabKey === TYPE_PHYSICAL) return !isAccessory;
            return true;
        }).map(function (order) {
            return withOrderType(order, isAccessoryOrder(order) ? TYPE_ACCESSORY : TYPE_PHYSICAL);
        });
    }

    /**
     * Returns service orders imported or synchronized from the provider flow.
     *
     * @returns {Array<Record<string, unknown>>}
     */
    function getServiceOrders() {
        return (TZ.db.serviceOrders || []).map(function (order) {
            return withOrderType(order, TYPE_SERVICE);
        });
    }

    /**
     * Returns repair bookings with the same table shape as orders.
     *
     * @returns {Array<Record<string, unknown>>}
     */
    function getRepairOrders() {
        return (TZ.db.repairBookings || []).map(function (order) {
            return withOrderType(order, TYPE_REPAIR);
        });
    }

    /**
     * Resolves the order collection for one tab.
     *
     * @param {string} tabKey
     * @returns {Array<Record<string, unknown>>}
     */
    function getOrdersForTab(tabKey) {
        if (tabKey === TYPE_SERVICE) return getServiceOrders();
        if (tabKey === TYPE_REPAIR) return getRepairOrders();
        if (tabKey === TYPE_PHYSICAL || tabKey === TYPE_ACCESSORY) return getProductOrdersForTab(tabKey);
        return getProductOrdersForTab(TYPE_ALL).concat(getServiceOrders(), getRepairOrders());
    }

    /**
     * Returns orders for the active tab.
     *
     * @returns {Array<Record<string, unknown>>}
     */
    function getOrders() {
        return getOrdersForTab(activeTab);
    }

    /**
     * Resolves the UI type for a mixed order record.
     *
     * @param {Record<string, unknown>} order
     * @returns {string}
     */
    function getOrderType(order) {
        return order?.__orderType || (activeTab === TYPE_ALL ? TYPE_PHYSICAL : activeTab);
    }

    /**
     * Returns the Arabic label for one order type.
     *
     * @param {string} orderType
     * @returns {string}
     */
    function getOrderTypeLabel(orderType) {
        return TYPE_LABELS[orderType] || TYPE_LABELS.physical;
    }

    /**
     * Returns the Font Awesome icon for one order type.
     *
     * @param {string} orderType
     * @returns {string}
     */
    function getOrderTypeIcon(orderType) {
        if (orderType === TYPE_SERVICE) return 'fa-bolt';
        if (orderType === TYPE_ACCESSORY) return 'fa-headphones';
        if (orderType === TYPE_REPAIR) return 'fa-screwdriver-wrench';
        return 'fa-box';
    }

    /**
     * Returns a CSS modifier for one order type.
     *
     * @param {string} orderType
     * @returns {string}
     */
    function getOrderTypeClass(orderType) {
        return 'admin-order-kind--' + (TYPE_LABELS[orderType] ? orderType : TYPE_PHYSICAL);
    }

    /**
     * Returns the best creation date for an order row.
     *
     * @param {Record<string, unknown>} order
     * @returns {string}
     */
    function getOrderDate(order) {
        return order.createdAt || order.created_at || '';
    }

    /**
     * Resolves a customer profile for a service order when the row only stores user_id.
     *
     * @param {Record<string, unknown>} order
     * @returns {Record<string, unknown> | null}
     */
    function getLinkedCustomer(order) {
        var userId = order.userId || order.user_id;
        return userId && typeof TZ.getUserById === 'function' ? TZ.getUserById(userId) || null : null;
    }

    /**
     * Builds the searchable values for one mixed order row.
     *
     * @param {Record<string, unknown>} order
     * @returns {Array<unknown>}
     */
    function getOrderSearchTokens(order) {
        var customer = getLinkedCustomer(order);
        var itemNames = Array.isArray(order.items)
            ? order.items.map(function (item) { return item.productName || item.product_name || ''; }).join(' ')
            : '';

        return [
            order.id,
            order.displayNumber,
            order.display_number,
            order.displayNumber ? '#' + order.displayNumber : '',
            A.formatOrderNumber ? A.formatOrderNumber(order) : '',
            order.customerName,
            order.customer_name,
            order.customerPhone,
            order.customer_phone,
            order.customerEmail,
            order.customer_email,
            order.name,
            order.phone,
            order.email,
            customer?.fullName,
            customer?.email,
            customer?.phone,
            order.device,
            order.service_name,
            order.serviceName,
            order.externalOrderId,
            order.providerName,
            order.link,
            order.notes,
            order.description,
            itemNames
        ];
    }

    /**
     * Filters the active list by status and search text.
     *
     * @param {Array<Record<string, unknown>>} list
     * @returns {Array<Record<string, unknown>>}
     */
    function applyFilters(list) {
        return list.filter(function (order) {
            var matchesStatus = !filterStatus || getOrderDisplayStatus(order, activeTab) === filterStatus;
            var query = searchQuery.toLowerCase();
            var matchesSearch = !query || getOrderSearchTokens(order).some(function (value) {
                return String(value || '').toLowerCase().includes(query);
            });
            return matchesStatus && matchesSearch;
        });
    }

    /**
     * Converts one order timestamp into a sortable numeric value.
     *
     * @param {Record<string, unknown>} order
     * @returns {number}
     */
    function getOrderTimestamp(order) {
        var timestamp = new Date(getOrderDate(order)).getTime();
        return Number.isFinite(timestamp) ? timestamp : 0;
    }

    /**
     * Returns a sortable urgency rank for one order row.
     *
     * Lower values mean the order should appear earlier for admins.
     *
     * @param {Record<string, unknown>} order
     * @returns {number}
     */
    function getOrderPriorityRank(order) {
        var status = getOrderDisplayStatus(order, activeTab);
        if (['pending', 'awaiting_delivery', 'confirmed', 'received', 'waiting_approval'].includes(status)) return 0;
        if (['processing', 'in_progress', 'diagnosing', 'shipped', 'partial'].includes(status)) return 1;
        if (['ready', 'delivered', 'completed', 'refunded'].includes(status)) return 2;
        return 3;
    }

    /**
     * Returns whether one order needs immediate admin attention.
     *
     * @param {Record<string, unknown>} order
     * @returns {boolean}
     */
    function isUrgentOrder(order) {
        return getOrderPriorityRank(order) <= 1;
    }

    /**
     * Returns the numeric amount used for amount-based sorting.
     *
     * @param {Record<string, unknown>} order
     * @returns {number}
     */
    function getOrderAmountValue(order) {
        return Number(order?.total || 0) || 0;
    }

    /**
     * Sorts the filtered order list according to the selected admin sort mode.
     *
     * @param {Array<Record<string, unknown>>} list
     * @returns {Array<Record<string, unknown>>}
     */
    function sortOrdersList(list) {
        return list.slice().sort(function (first, second) {
            if (sortMode === 'oldest') return getOrderTimestamp(first) - getOrderTimestamp(second);
            if (sortMode === 'amount') return getOrderAmountValue(second) - getOrderAmountValue(first);
            if (sortMode === 'newest') return getOrderTimestamp(second) - getOrderTimestamp(first);

            var priorityDifference = getOrderPriorityRank(first) - getOrderPriorityRank(second);
            if (priorityDifference !== 0) return priorityDifference;
            return getOrderTimestamp(second) - getOrderTimestamp(first);
        });
    }

    /**
     * Paginates a sorted orders list.
     *
     * @param {Array<Record<string, unknown>>} list
     * @returns {{ items: Array<Record<string, unknown>>, total: number, totalPages: number }}
     */
    function paginate(list) {
        var start = (currentPage - 1) * PAGE_SIZE;
        return {
            items: list.slice(start, start + PAGE_SIZE),
            total: list.length,
            totalPages: Math.ceil(list.length / PAGE_SIZE) || 1
        };
    }

    /**
     * Returns a Supabase auth token for admin API calls.
     *
     * @returns {Promise<string>}
     */
    async function getAdminAuthToken() {
        var sessionResult = await TZ.supabase.auth.getSession();
        return sessionResult?.data?.session?.access_token || '';
    }

    /**
     * Resolves the local API base URL while using Vite/Wrangler split ports.
     *
     * @returns {string}
     */
    function getAdminApiBaseUrl() {
        var currentPort = window.location.port;
        return (currentPort !== API_PORT && currentPort !== '') ? ('http://localhost:' + API_PORT) : '';
    }

    /**
     * Maps legacy product-order statuses into the simplified workflow.
     *
     * @param {string} status
     * @returns {string}
     */
    function normalizePhysicalOrderStatus(status) {
        var normalizedStatus = String(status || '').trim().toLowerCase();
        return LEGACY_PHYSICAL_STATUS_MAP[normalizedStatus] || normalizedStatus;
    }

    /**
     * Resolves status filter options for one tab.
     *
     * @param {string} tabKey
     * @returns {string[]}
     */
    function getStatusOptionsForTab(tabKey) {
        if (tabKey === TYPE_SERVICE) return SERVICE_STATUS_OPTIONS.slice();
        if (tabKey === TYPE_REPAIR) return REPAIR_STATUS_OPTIONS.slice();
        if (tabKey === TYPE_ALL) {
            return Array.from(new Set(
                PHYSICAL_STATUS_OPTIONS.concat(SERVICE_STATUS_OPTIONS, REPAIR_STATUS_OPTIONS)
            ));
        }
        return PHYSICAL_STATUS_OPTIONS.slice();
    }

    /**
     * Resolves the status used for badges, filtering, and action highlighting.
     *
     * @param {Record<string, unknown>} order
     * @param {string} tabKey
     * @returns {string}
     */
    function getOrderDisplayStatus(order, tabKey) {
        var currentStatus = String(order?.status || '').trim().toLowerCase();
        var orderType = tabKey === TYPE_ALL ? getOrderType(order) : tabKey;
        return orderType === TYPE_PHYSICAL || orderType === TYPE_ACCESSORY
            ? normalizePhysicalOrderStatus(currentStatus)
            : currentStatus;
    }

    /**
     * Resolves the display label for a status.
     *
     * @param {string} status
     * @param {string} tabKey
     * @returns {string}
     */
    function getStatusLabel(status, tabKey) {
        if (tabKey === TYPE_PHYSICAL || tabKey === TYPE_ACCESSORY) {
            return PHYSICAL_STATUS_ACTION_LABELS[status] || ORDER_STATUSES[status] || status;
        }
        return ORDER_STATUSES[status] || PHYSICAL_STATUS_ACTION_LABELS[status] || status;
    }

    /**
     * Builds the physical-order status buttons shown in the actions column.
     *
     * @param {{ currentStatus: string, isPending: boolean, orderId: string, orderType?: string }} options
     * @returns {string}
     */
    function buildPhysicalStatusActionsMarkup(options) {
        var orderId = String(options?.orderId || '').trim();
        var orderType = options?.orderType || TYPE_PHYSICAL;
        var currentStatus = normalizePhysicalOrderStatus(options?.currentStatus);
        var isPending = options?.isPending === true;

        return '<div class="order-status-actions" role="group" aria-label="إجراءات حالة الطلب">'
            + PHYSICAL_STATUS_OPTIONS.map(function (status) {
                var isActive = currentStatus === status;
                var isDisabled = isPending || isActive;
                var buttonLabel = getStatusLabel(status, orderType);
                return '<button type="button" class="order-status-action order-status-action--' + status
                    + (isActive ? ' is-active' : '')
                    + '" data-order-id="' + esc(orderId)
                    + '" data-order-type="' + esc(orderType)
                    + '" data-status="' + status
                    + '" aria-pressed="' + (isActive ? 'true' : 'false') + '"'
                    + (isDisabled ? ' disabled' : '')
                    + '>' + esc(buttonLabel) + '</button>';
            }).join('')
            + '</div>';
    }

    /**
     * Shows a normalized admin status error.
     *
     * @param {string} message
     * @returns {void}
     */
    function showOrderStatusError(message) {
        var normalized = String(message || '').trim();
        if (CODED_ERROR_PATTERN.test(normalized)) {
            A.showToast(normalized);
            return;
        }

        A.showErrorToast('ORM-301', normalized || 'تعذر تحديث حالة الطلب.');
    }

    /**
     * Updates a product or accessory order status through the secure admin API.
     *
     * @param {string} orderId
     * @param {string} newStatus
     * @returns {Promise<void>}
     */
    async function changeServerOrderStatus(orderId, newStatus) {
        var token = await getAdminAuthToken();
        var response = await fetch(getAdminApiBaseUrl() + ADMIN_ORDER_STATUS_API, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                orderId: orderId,
                status: newStatus,
                targetType: 'physical_order'
            })
        });
        var payload = null;

        try {
            payload = await response.json();
        } catch (error) {
            void error;
        }

        if (!response.ok || !payload || payload.success !== true) {
            throw new Error(payload?.error || ('[ORM-500] تعذر تحديث حالة الطلب (' + response.status + ').'));
        }
    }

    /**
     * Updates a repair booking status directly through Supabase.
     *
     * @param {string} orderId
     * @param {string} newStatus
     * @returns {Promise<void>}
     */
    async function changeRepairOrderStatus(orderId, newStatus) {
        var result = await TZ.supabase.from('repair_bookings').update({
            status: newStatus,
            updated_at: new Date().toISOString()
        }).eq('id', orderId);

        if (result.error) {
            throw new Error(result.error.message || '');
        }
    }

    /**
     * Changes an order status for the supported editable order types.
     *
     * @param {string} orderId
     * @param {string} newStatus
     * @param {string} orderType
     * @returns {Promise<void>}
     */
    async function changeOrderStatus(orderId, newStatus, orderType) {
        var normalizedOrderId = String(orderId || '').trim();
        var normalizedType = String(orderType || TYPE_PHYSICAL).trim();
        if (!normalizedOrderId || pendingStatusOrderIds.has(normalizedOrderId)) return;
        if (normalizedType === TYPE_SERVICE) return;

        pendingStatusOrderIds.add(normalizedOrderId);
        renderOrders();

        try {
            if (normalizedType === TYPE_REPAIR) await changeRepairOrderStatus(normalizedOrderId, newStatus);
            else await changeServerOrderStatus(normalizedOrderId, newStatus);

            A.showToast('تم تحديث حالة الطلب بنجاح');
            await TZ.refreshData();
        } catch (error) {
            showOrderStatusError(error?.message || '');
        } finally {
            pendingStatusOrderIds.delete(normalizedOrderId);
            renderOrders();
        }
    }

    /**
     * Builds the repair booking status dropdown.
     *
     * @param {Record<string, unknown>} order
     * @returns {string}
     */
    function buildRepairStatusDropdown(order) {
        return '<select class="order-status-select" data-order-id="' + esc(order.id) + '" data-order-type="' + TYPE_REPAIR + '">'
            + REPAIR_STATUS_OPTIONS.map(function (status) {
                return '<option value="' + status + '"' + (order.status === status ? ' selected' : '') + '>' + esc(getStatusLabel(status, TYPE_REPAIR)) + '</option>';
            }).join('')
            + '</select>';
    }

    /**
     * Builds the editable or read-only status control for one row.
     *
     * @param {Record<string, unknown>} order
     * @returns {string}
     */
    function buildStatusControl(order) {
        var orderType = getOrderType(order);
        if (orderType === TYPE_REPAIR) return buildRepairStatusDropdown(order);
        if (orderType === TYPE_SERVICE) {
            return '<span class="admin-order-actions-placeholder"><i class="fas fa-sync-alt"></i> تتم مزامنتها من المزود</span>';
        }

        return buildPhysicalStatusActionsMarkup({
            orderId: order.id,
            orderType: orderType,
            currentStatus: order.status,
            isPending: pendingStatusOrderIds.has(String(order.id || '').trim())
        });
    }

    /**
     * Builds a labeled metadata line.
     *
     * @param {string} label
     * @param {unknown} value
     * @returns {string}
     */
    function buildMetaLine(label, value) {
        var normalizedValue = String(value || '').trim();
        if (!normalizedValue) return '';

        return '<div class="order-meta-line"><strong>' + esc(label) + ':</strong> ' + esc(normalizedValue) + '</div>';
    }

    /**
     * Builds a safe external link line for service order details.
     *
     * @param {string} label
     * @param {unknown} value
     * @returns {string}
     */
    function buildLinkMetaLine(label, value) {
        var rawValue = String(value || '').trim();
        if (!rawValue) return '';

        try {
            var parsedUrl = new URL(rawValue, window.location.origin);
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) return buildMetaLine(label, rawValue);
            return '<div class="order-meta-line"><strong>' + esc(label) + ':</strong> '
                + '<a href="' + esc(parsedUrl.href) + '" target="_blank" rel="noopener noreferrer">'
                + esc(truncateText(rawValue, 42)) + '</a></div>';
        } catch (error) {
            void error;
            return buildMetaLine(label, rawValue);
        }
    }

    /**
     * Builds the order number and type badge cell.
     *
     * @param {Record<string, unknown>} order
     * @returns {string}
     */
    function buildOrderNumberCell(order) {
        var orderType = getOrderType(order);
        var orderLabel = A.formatOrderNumber ? A.formatOrderNumber(order) : String(order.id || '-');
        var rawId = String(order.id || '').trim();
        var rawIdLine = rawId && orderLabel !== rawId
            ? '<small class="admin-order-raw-id">ID: ' + esc(rawId) + '</small>'
            : '';

        return '<td><div class="admin-order-number">'
            + '<strong>' + esc(orderLabel) + '</strong>'
            + '<span class="admin-order-kind ' + getOrderTypeClass(orderType) + '">'
            + '<i class="fas ' + getOrderTypeIcon(orderType) + '"></i> ' + esc(getOrderTypeLabel(orderType))
            + '</span>'
            + rawIdLine
            + '</div></td>';
    }

    /**
     * Builds the customer cell for every order type.
     *
     * @param {Record<string, unknown>} order
     * @returns {string}
     */
    function buildCustomerCell(order) {
        var customer = getLinkedCustomer(order);
        var customerName = order.customer_name || order.customerName || order.name || customer?.fullName || customer?.email || '-';
        var phone = order.customer_phone || order.customerPhone || order.phone || customer?.phone || '';
        var email = order.customer_email || order.customerEmail || order.email || customer?.email || '';

        return '<td><div class="admin-order-cell-stack">'
            + '<strong>' + esc(customerName) + '</strong>'
            + buildMetaLine('الهاتف', phone)
            + buildMetaLine('البريد', email)
            + '</div></td>';
    }

    /**
     * Counts product quantities in an order.
     *
     * @param {Record<string, unknown>} order
     * @returns {number}
     */
    function getOrderItemCount(order) {
        if (!Array.isArray(order.items)) return 0;
        return order.items.reduce(function (total, item) {
            return total + (Number(item.qty || 0) || 0);
        }, 0);
    }

    /**
     * Builds a compact product item preview.
     *
     * @param {Record<string, unknown>} order
     * @returns {string}
     */
    function getOrderItemsPreview(order) {
        if (!Array.isArray(order.items) || order.items.length === 0) return '';

        return order.items.map(function (item) {
            var productName = String(item.productName || item.product_name || '').trim();
            var quantity = Number(item.qty || 0) || 0;
            if (!productName) return '';
            return quantity > 1 ? productName + ' x' + quantity : productName;
        }).filter(Boolean).slice(0, 3).join('، ');
    }

    /**
     * Builds product or accessory order details.
     *
     * @param {Record<string, unknown>} order
     * @returns {string}
     */
    function buildPhysicalDetailsCell(order) {
        var itemCount = getOrderItemCount(order);
        var deliveryMethodLabel = A.deliveryLabel
            ? A.deliveryLabel(order.delivery_method || order.deliveryMethod)
            : (order.delivery_method || order.deliveryMethod || '-');
        var paymentMethodLabel = A.paymentLabel
            ? A.paymentLabel(order.payment_method || order.paymentMethod)
            : (order.payment_method || order.paymentMethod || '-');

        return '<td><div class="admin-order-cell-stack">'
            + buildMetaLine('العناصر', itemCount > 0 ? itemCount + ' قطعة' : 'بدون عناصر')
            + buildMetaLine('المنتجات', getOrderItemsPreview(order))
            + buildMetaLine('التسليم', deliveryMethodLabel)
            + buildMetaLine('الدفع', paymentMethodLabel)
            + buildMetaLine('ملاحظات', truncateText(order.notes, ORDER_NOTES_PREVIEW_LENGTH))
            + '</div></td>';
    }

    /**
     * Builds digital service order details.
     *
     * @param {Record<string, unknown>} order
     * @returns {string}
     */
    function buildServiceDetailsCell(order) {
        return '<td><div class="admin-order-cell-stack">'
            + buildMetaLine('الخدمة', order.service_name || order.serviceName || '-')
            + buildMetaLine('الكمية', Number(order.quantity || 0) || '')
            + buildMetaLine('المزود', order.providerName || 'Serva-S')
            + buildMetaLine('رقم المزود', order.externalOrderId)
            + buildLinkMetaLine('الرابط', order.link)
            + buildMetaLine('ملاحظة', truncateText(order.adminNote, ORDER_NOTES_PREVIEW_LENGTH))
            + '</div></td>';
    }

    /**
     * Builds repair booking details.
     *
     * @param {Record<string, unknown>} order
     * @returns {string}
     */
    function buildRepairDetailsCell(order) {
        var preferredDate = order.preferredDate ? A.formatDate(order.preferredDate) : '';

        return '<td><div class="admin-order-cell-stack">'
            + buildMetaLine('الجهاز', order.device || '-')
            + buildMetaLine('الخدمة', order.service_name || order.serviceName || '-')
            + buildMetaLine('الموعد المفضل', preferredDate)
            + buildMetaLine('الوصف', truncateText(order.description, ORDER_NOTES_PREVIEW_LENGTH))
            + '</div></td>';
    }

    /**
     * Builds the amount cell while preserving a unified table shape.
     *
     * @param {Record<string, unknown>} order
     * @returns {string}
     */
    function buildAmountCell(order) {
        var orderType = getOrderType(order);
        if (orderType === TYPE_REPAIR) {
            return '<td><span class="admin-order-actions-placeholder">غير محدد</span></td>';
        }

        var shippingFee = Number(order.shipping_fee || order.shippingFee || 0);
        var shippingLabel = shippingFee > 0 ? TZ.formatPrice(shippingFee) : 'مجاني';

        return '<td><div class="admin-order-cell-stack">'
            + '<strong class="admin-order-amount">' + TZ.formatPrice(order.total || 0) + '</strong>'
            + (orderType === TYPE_SERVICE ? buildMetaLine('سعر الوحدة', TZ.formatPrice(order.price || 0)) : buildMetaLine('الشحن', shippingLabel))
            + '</div></td>';
    }

    /**
     * Builds the status badge for one row.
     *
     * @param {Record<string, unknown>} order
     * @returns {string}
     */
    function buildStatusBadge(order) {
        var displayStatus = getOrderDisplayStatus(order, activeTab);
        var badgeLabel = getStatusLabel(displayStatus, getOrderType(order));

        return '<span class="status-badge ' + esc(displayStatus) + '">' + esc(badgeLabel) + '</span>';
    }

    /**
     * Builds the details cell according to the order type.
     *
     * @param {Record<string, unknown>} order
     * @returns {string}
     */
    function buildDetailsCell(order) {
        var orderType = getOrderType(order);
        if (orderType === TYPE_SERVICE) return buildServiceDetailsCell(order);
        if (orderType === TYPE_REPAIR) return buildRepairDetailsCell(order);
        return buildPhysicalDetailsCell(order);
    }

    /**
     * Renders one table row.
     *
     * @param {Record<string, unknown>} order
     * @returns {string}
     */
    function renderOrderRow(order) {
        var dateValue = getOrderDate(order);
        var date = A.formatDateTime ? A.formatDateTime(dateValue) : A.formatDate(dateValue);
        var orderType = getOrderType(order);

        return '<tr class="admin-order-row admin-order-row--' + esc(orderType) + (isUrgentOrder(order) ? ' admin-order-row--urgent' : '') + '" data-order-id="' + esc(order.id) + '" data-order-type="' + esc(orderType) + '">'
            + buildOrderNumberCell(order)
            + buildCustomerCell(order)
            + buildDetailsCell(order)
            + buildAmountCell(order)
            + '<td>' + buildStatusBadge(order) + '</td>'
            + '<td><div class="admin-order-date"><strong>' + esc(date) + '</strong><small>' + esc(getOrderTypeLabel(orderType)) + '</small></div></td>'
            + '<td class="actions-cell">' + buildStatusControl(order) + '</td>'
            + '</tr>';
    }

    /**
     * Builds summary stats for the current tab.
     *
     * @param {Array<Record<string, unknown>>} allOrders
     * @param {Array<Record<string, unknown>>} filteredOrders
     * @returns {string}
     */
    function buildSummaryMarkup(allOrders, filteredOrders) {
        var totalAmount = allOrders.reduce(function (sum, order) {
            return sum + (getOrderType(order) === TYPE_REPAIR ? 0 : Number(order.total || 0));
        }, 0);
        var latestOrder = allOrders.reduce(function (latest, order) {
            var latestTime = latest ? new Date(getOrderDate(latest)).getTime() : 0;
            var orderTime = new Date(getOrderDate(order)).getTime();
            return Number.isFinite(orderTime) && orderTime > latestTime ? order : latest;
        }, null);
        var latestOrderLabel = latestOrder
            ? (A.formatOrderNumber ? A.formatOrderNumber(latestOrder) : String(latestOrder.id || '-'))
            : '-';
        var totalAmountLabel = typeof TZ.formatPrice === 'function'
            ? TZ.formatPrice(totalAmount)
            : totalAmount.toLocaleString('ar-JO');
        var pendingCount = allOrders.filter(function (order) {
            return ['pending', 'awaiting_delivery', 'confirmed'].includes(String(order.status || '').toLowerCase());
        }).length;
        var activeCount = allOrders.filter(function (order) {
            return ['processing', 'in_progress', 'shipped', 'diagnosing', 'waiting_approval'].includes(String(order.status || '').toLowerCase());
        }).length;
        var completedCount = allOrders.filter(function (order) {
            return ['delivered', 'completed', 'ready'].includes(String(order.status || '').toLowerCase());
        }).length;
        var urgentCount = allOrders.filter(isUrgentOrder).length;

        return '<div class="admin-orders-summary">'
            + '<div class="admin-orders-stat"><span><i class="fas fa-layer-group"></i> الإجمالي</span><strong>' + allOrders.length + '</strong></div>'
            + '<div class="admin-orders-stat"><span><i class="fas fa-filter"></i> بعد التصفية</span><strong>' + filteredOrders.length + '</strong></div>'
            + '<div class="admin-orders-stat"><span><i class="fas fa-bolt"></i> تحتاج متابعة</span><strong>' + urgentCount + '</strong></div>'
            + '<div class="admin-orders-stat"><span><i class="fas fa-hourglass-half"></i> بانتظار الإجراء</span><strong>' + pendingCount + '</strong></div>'
            + '<div class="admin-orders-stat"><span><i class="fas fa-spinner"></i> قيد التنفيذ</span><strong>' + activeCount + '</strong></div>'
            + '<div class="admin-orders-stat"><span><i class="fas fa-check-circle"></i> منجزة</span><strong>' + completedCount + '</strong></div>'
            + '<div class="admin-orders-stat"><span><i class="fas fa-sack-dollar"></i> قيمة الطلبات</span><strong>' + esc(totalAmountLabel) + '</strong></div>'
            + '<div class="admin-orders-stat admin-orders-stat--highlight"><span><i class="fas fa-clock"></i> أحدث طلب</span><strong>' + esc(latestOrderLabel) + '</strong></div>'
            + '</div>';
    }

    /**
     * Builds the sort-mode options shown in the toolbar.
     *
     * @returns {string}
     */
    function buildSortOptionsMarkup() {
        return [
            { value: 'priority', label: 'الأهم أولًا' },
            { value: 'newest', label: 'الأحدث أولًا' },
            { value: 'oldest', label: 'الأقدم أولًا' },
            { value: 'amount', label: 'الأعلى قيمة' }
        ].map(function (option) {
            return '<option value="' + option.value + '"' + (sortMode === option.value ? ' selected' : '') + '>' + option.label + '</option>';
        }).join('');
    }

    /**
     * Builds table pagination controls.
     *
     * @param {{ items: Array<Record<string, unknown>>, total: number, totalPages: number }} page
     * @returns {string}
     */
    function renderPagination(page) {
        if (page.totalPages <= 1) return '';

        return '<div class="admin-table-pagination"><div class="admin-table-pagination-info">عرض ' + page.items.length + ' من ' + page.total + '</div><div class="admin-table-pagination-controls">'
            + '<button data-page="' + (currentPage - 1) + '"' + (currentPage <= 1 ? ' disabled' : '') + '><i class="fas fa-chevron-right"></i></button>'
            + Array.from({ length: page.totalPages }, function (_, index) {
                var pageNumber = index + 1;
                return '<button data-page="' + pageNumber + '" class="' + (pageNumber === currentPage ? 'active' : '') + '">' + pageNumber + '</button>';
            }).join('')
            + '<button data-page="' + (currentPage + 1) + '"' + (currentPage >= page.totalPages ? ' disabled' : '') + '><i class="fas fa-chevron-left"></i></button></div></div>';
    }

    /**
     * Renders the current orders section.
     *
     * @returns {void}
     */
    function renderOrders() {
        var allOrders = getOrders();
        var filtered = applyFilters(allOrders);
        var sorted = sortOrdersList(filtered);
        var page = paginate(sorted);
        var activeTabMeta = TAB_CONFIG.find(function (tab) { return tab.key === activeTab; }) || TAB_CONFIG[0];
        var tabsHtml = TAB_CONFIG.map(function (tab) {
            var count = getOrdersForTab(tab.key).length;
            return '<button class="admin-tab' + (activeTab === tab.key ? ' active' : '') + '" data-tab="' + tab.key + '"><i class="fas ' + tab.icon + '"></i> ' + tab.label + ' <span class="tab-count">' + count + '</span></button>';
        }).join('');
        var rowsHtml = page.items.length
            ? page.items.map(renderOrderRow).join('')
            : '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-inbox"></i><p>لا توجد طلبات مطابقة</p></div></td></tr>';
        var statusOptionsHtml = getStatusOptionsForTab(activeTab).map(function (status) {
            return '<option value="' + status + '"' + (filterStatus === status ? ' selected' : '') + '>' + getStatusLabel(status, activeTab) + '</option>';
        }).join('');

        A.adminContent.innerHTML = '<div class="admin-section-header"><div><h2><i class="fas fa-shopping-cart"></i> ' + esc(activeTabMeta.label) + '</h2><p>قراءة موحدة لكل الطلبات بأرقام سهلة مثل #2000 مع فرز واضح حسب الأولوية والحالة.</p></div></div>'
            + '<div class="admin-tabs">' + tabsHtml + '</div>'
            + buildSummaryMarkup(allOrders, filtered)
            + '<div class="filter-bar admin-orders-toolbar"><input type="search" id="ordersSearch" placeholder="ابحث برقم الطلب مثل #2000 أو باسم العميل أو الهاتف..." value="' + esc(searchQuery) + '"><select id="ordersStatusFilter"><option value="">كل الحالات</option>'
            + statusOptionsHtml
            + '</select><select id="ordersSortMode">' + buildSortOptionsMarkup() + '</select></div><div class="admin-panel admin-orders-panel"><div class="panel-body"><div class="table-wrap admin-orders-table-wrap"><table class="data-table admin-orders-table"><thead><tr>'
            + '<th>رقم الطلب</th><th>العميل</th><th>تفاصيل الطلب</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th>'
            + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>'
            + renderPagination(page)
            + '</div>';

        bindEvents();
    }

    /**
     * Binds events after each render.
     *
     * @returns {void}
     */
    function bindEvents() {
        document.querySelectorAll('.admin-tab[data-tab]').forEach(function (button) {
            button.addEventListener('click', function () {
                activeTab = button.dataset.tab;
                filterStatus = '';
                searchQuery = '';
                currentPage = 1;
                renderOrders();
            });
        });

        document.getElementById('ordersSearch')?.addEventListener('input', function () {
            searchQuery = this.value;
            currentPage = 1;
            renderOrders();
        });

        document.getElementById('ordersStatusFilter')?.addEventListener('change', function () {
            filterStatus = this.value;
            currentPage = 1;
            renderOrders();
        });
        document.getElementById('ordersSortMode')?.addEventListener('change', function () {
            sortMode = this.value || 'priority';
            currentPage = 1;
            renderOrders();
        });

        document.querySelectorAll('[data-page]').forEach(function (button) {
            button.addEventListener('click', function () {
                var page = parseInt(button.dataset.page, 10);
                if (page >= 1) {
                    currentPage = page;
                    renderOrders();
                }
            });
        });

        document.querySelectorAll('.order-status-select').forEach(function (select) {
            var originalValue = select.value;
            select.addEventListener('change', function () {
                var newStatus = select.value;
                var orderId = select.dataset.orderId;
                var orderType = select.dataset.orderType;

                if (newStatus === originalValue) return;
                if (!window.confirm('هل تريد تغيير حالة الطلب إلى "' + getStatusLabel(newStatus, orderType) + '"؟')) {
                    select.value = originalValue;
                    return;
                }

                void changeOrderStatus(orderId, newStatus, orderType);
            });
        });

        document.querySelectorAll('.order-status-action[data-order-id][data-status]').forEach(function (button) {
            button.addEventListener('click', function () {
                var newStatus = button.dataset.status;
                var orderId = button.dataset.orderId;
                var orderType = button.dataset.orderType;

                if (button.disabled || !newStatus || !orderId) return;
                if (!window.confirm('هل تريد تغيير حالة الطلب إلى "' + getStatusLabel(newStatus, orderType) + '"؟')) return;

                void changeOrderStatus(orderId, newStatus, orderType);
            });
        });
    }

    A.sections.orders = function () { activeTab = TYPE_ALL; renderOrders(); };
    A.sections['product-orders'] = function () { activeTab = TYPE_PHYSICAL; renderOrders(); };
    A.sections['service-orders'] = function () { activeTab = TYPE_SERVICE; renderOrders(); };
    A.sections['accessory-orders'] = function () { activeTab = TYPE_ACCESSORY; renderOrders(); };
    A.sections['repair-orders'] = function () { activeTab = TYPE_REPAIR; renderOrders(); };

    if (window.__ENABLE_ORDER_ADMIN_TEST_HOOKS__) {
        window.__orderAdminTestHooks = {
            buildPhysicalStatusActionsMarkup: buildPhysicalStatusActionsMarkup,
            getOrderDisplayStatus: getOrderDisplayStatus,
            getOrdersForTab: getOrdersForTab,
            getOrderPriorityRank: getOrderPriorityRank,
            getOrderType: getOrderType,
            getOrderTypeLabel: getOrderTypeLabel,
            getStatusLabel: getStatusLabel,
            getStatusOptionsForTab: getStatusOptionsForTab,
            normalizePhysicalOrderStatus: normalizePhysicalOrderStatus,
            sortOrdersList: sortOrdersList
        };
    }
})();
