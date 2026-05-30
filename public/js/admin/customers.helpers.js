/**
 * TechZone Admin - Customers Helpers
 * Shared customer summary and activity helpers.
 */
(function () {
    'use strict';

    function normalizeText(value) {
        return String(value || '').trim().toLowerCase();
    }

    function uniqueValues(values) {
        return values.filter(function (value, index, list) {
            return Boolean(value) && list.indexOf(value) === index;
        });
    }

    function getCustomerKeys(userOrId) {
        if (userOrId && typeof userOrId === 'object') {
            return uniqueValues([
                normalizeText(userOrId.id),
                normalizeText(userOrId.authUserId),
                normalizeText(userOrId.auth_user_id),
                normalizeText(userOrId.profileId),
                normalizeText(userOrId.profile_id),
                normalizeText(userOrId.userId),
                normalizeText(userOrId.user_id),
                normalizeText(userOrId.email),
                normalizeText(userOrId.customerEmail),
                normalizeText(userOrId.customer_email)
            ]);
        }

        return uniqueValues([normalizeText(userOrId)]);
    }

    function matchesCustomer(userOrId, record) {
        var keys = getCustomerKeys(userOrId);
        var recordKeys = getCustomerKeys(record);

        return keys.some(function (key) {
            return recordKeys.includes(key);
        });
    }

    function canManageCustomerWallet(access) {
        if (!access) return true;
        if (access.isFullAdmin === true) return true;

        return Boolean(access.permissions
            && access.permissions.customers
            && access.permissions.customers.manage === true);
    }

    function normalizeWalletAdjustmentInput(input) {
        var amount = Number(input && input.amount);
        var mode = normalizeText(input && input.mode) === 'debit' ? 'debit' : 'credit';
        var reason = String((input && input.reason) || '').trim();

        if (!Number.isFinite(amount) || amount <= 0) {
            return {
                errorCode: 'CUS-307',
                errorMessage: 'أدخل مبلغًا صحيحًا أكبر من صفر.'
            };
        }

        return {
            amount: mode === 'debit' ? -Math.abs(amount) : Math.abs(amount),
            mode: mode,
            reason: reason
        };
    }

    function sortByCreatedAtDesc(first, second) {
        var secondTimestamp = new Date(second?.createdAt || second?.created_at || 0).getTime();
        var firstTimestamp = new Date(first?.createdAt || first?.created_at || 0).getTime();
        return secondTimestamp - firstTimestamp;
    }

    function collectCustomerOrders(userOrId, orders) {
        return (Array.isArray(orders) ? orders : []).filter(function (order) {
            return matchesCustomer(userOrId, order);
        });
    }

    function collectCustomerRepairBookings(userOrId, repairBookings) {
        return (Array.isArray(repairBookings) ? repairBookings : []).filter(function (booking) {
            return matchesCustomer(userOrId, booking);
        });
    }

    function collectCustomerDeposits(userOrId, deposits) {
        return (Array.isArray(deposits) ? deposits : []).filter(function (deposit) {
            return matchesCustomer(userOrId, deposit);
        });
    }

    function collectOrderActivity(userOrId, orders, repairBookings, deposits) {
        var orderActivity = collectCustomerOrders(userOrId, orders).map(function (order) {
            return {
                id: order.id,
                kind: 'order',
                label: order.displayNumber ? ('#' + order.displayNumber) : String(order.id || ''),
                title: order.customerName || order.customer_name || '',
                amount: Number(order.total || 0),
                status: order.status || 'pending',
                createdAt: order.createdAt || order.created_at || null
            };
        });
        var repairActivity = collectCustomerRepairBookings(userOrId, repairBookings).map(function (booking) {
            return {
                id: booking.id,
                kind: 'repair',
                label: String(booking.id || ''),
                title: booking.service_name || booking.serviceName || booking.device || '',
                amount: 0,
                status: booking.status || 'pending',
                createdAt: booking.createdAt || booking.created_at || null
            };
        });
        var depositActivity = collectCustomerDeposits(userOrId, deposits).map(function (deposit) {
            return {
                id: deposit.id,
                kind: 'deposit',
                label: String(deposit.id || ''),
                title: deposit.reference_number || deposit.referenceNumber || 'طلب إيداع',
                amount: Number(deposit.amount || 0),
                status: deposit.status || 'pending',
                createdAt: deposit.createdAt || deposit.created_at || null
            };
        });

        return orderActivity.concat(repairActivity, depositActivity)
            .filter(function (activity) { return Boolean(activity.createdAt); })
            .sort(sortByCreatedAtDesc);
    }

    function buildCustomerProfile(input) {
        var user = input?.user || {};
        var customerOrders = collectCustomerOrders(user, input?.orders);
        var repairBookings = collectCustomerRepairBookings(user, input?.repairBookings);
        var deposits = collectCustomerDeposits(user, input?.deposits);
        var totalSpend = customerOrders.reduce(function (sum, order) {
            return sum + Number(order.total || 0);
        }, 0);
        var lastOrder = customerOrders.slice().sort(sortByCreatedAtDesc)[0] || null;

        return {
            user: user,
            authUserId: user.authUserId || user.id || '',
            status: user.status || 'active',
            orderCount: customerOrders.length,
            repairCount: repairBookings.length,
            depositCount: deposits.length,
            totalSpend: totalSpend,
            lastOrderAt: lastOrder ? (lastOrder.createdAt || lastOrder.created_at || null) : null,
            searchableText: normalizeText([
                user.fullName,
                user.email,
                user.phone,
                user.country,
                user.role,
                user.status
            ].join(' ')),
            activity: collectOrderActivity(user, customerOrders, repairBookings, deposits)
        };
    }

    function filterCustomerProfiles(input) {
        var searchQuery = normalizeText(input?.searchQuery);
        var statusFilter = normalizeText(input?.statusFilter);

        return (Array.isArray(input?.profiles) ? input.profiles : []).filter(function (profile) {
            var profileStatus = normalizeText(profile?.status || profile?.user?.status);
            var searchableText = normalizeText(profile?.searchableText);
            var matchesStatus = !statusFilter || profileStatus === statusFilter;
            var matchesSearch = !searchQuery || searchableText.includes(searchQuery);
            return matchesStatus && matchesSearch;
        });
    }

    function formatCustomerStatus(status) {
        var normalizedStatus = normalizeText(status);
        if (normalizedStatus === 'inactive') return 'معطل';
        if (normalizedStatus === 'banned') return 'محظور';
        return 'نشط';
    }

    window.AdminCustomerHelpers = {
        buildCustomerProfile: buildCustomerProfile,
        collectCustomerDeposits: collectCustomerDeposits,
        collectCustomerOrders: collectCustomerOrders,
        collectCustomerRepairBookings: collectCustomerRepairBookings,
        collectOrderActivity: collectOrderActivity,
        canManageCustomerWallet: canManageCustomerWallet,
        filterCustomerProfiles: filterCustomerProfiles,
        formatCustomerStatus: formatCustomerStatus,
        getCustomerKeys: getCustomerKeys,
        matchesCustomer: matchesCustomer,
        normalizeWalletAdjustmentInput: normalizeWalletAdjustmentInput
    };

    if (window.__ENABLE_ADMIN_CUSTOMERS_TEST_HOOKS__) {
        window.__adminCustomerTestHooks = window.AdminCustomerHelpers;
    }
})();
