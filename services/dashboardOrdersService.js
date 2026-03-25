import { supabase } from '@/lib/supabaseClient';

/**
 * Loads the current signed-in user and profile snapshot used by the dashboard orders page.
 *
 * @returns {Promise<{ user: any, profile: { full_name?: string, phone?: string } | null, userEmail: string, profilePhone: string }>}
 */
async function getDashboardOrdersIdentity() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      profile: null,
      userEmail: '',
      profilePhone: '',
    };
  }

  const profileResponse = await supabase
    .from('user_profiles')
    .select('full_name, phone')
    .eq('user_id', user.id)
    .maybeSingle();

  const profile = profileResponse.data || null;

  return {
    user,
    profile,
    userEmail: (user.email || '').trim(),
    profilePhone: (profile?.phone || '').trim(),
  };
}

/**
 * Loads product orders and their nested order items for the signed-in customer.
 *
 * @param {string} userId
 * @returns {Promise<{
 *   orders: Array<Record<string, unknown>>,
 *   orderItemsMap: Record<string, Array<Record<string, unknown>>>,
 *   error: { message?: string } | null
 * }>}
 */
async function getProductOrdersSnapshot(userId) {
  const ordersResponse = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const orders = ordersResponse.data || [];
  const orderIds = orders.map((order) => order.id).filter(Boolean);
  let orderItemsMap = {};

  if (orderIds.length > 0) {
    const itemsResponse = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds)
      .order('id', { ascending: true });

    if (itemsResponse.data) {
      orderItemsMap = itemsResponse.data.reduce((accumulator, item) => {
        if (!accumulator[item.order_id]) {
          accumulator[item.order_id] = [];
        }

        accumulator[item.order_id].push(item);
        return accumulator;
      }, {});
    }
  }

  return {
    orders,
    orderItemsMap,
    error: ordersResponse.error,
  };
}

/**
 * Loads the customer's digital service orders.
 *
 * @param {string} userId
 * @returns {Promise<{ orders: Array<Record<string, unknown>>, error: { message?: string } | null }>}
 */
async function getDigitalOrdersSnapshot(userId) {
  const response = await supabase
    .from('service_orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return {
    orders: response.data || [],
    error: response.error,
  };
}

/**
 * Loads repair bookings linked to the user directly, by email, or by phone.
 *
 * @param {{ userId: string, userEmail: string, profilePhone: string }} params
 * @returns {Promise<{ bookings: Array<Record<string, unknown>>, error: boolean }>}
 */
async function getRepairBookingsSnapshot({ userId, userEmail, profilePhone }) {
  const queries = [
    supabase
      .from('repair_bookings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ];

  if (userEmail) {
    queries.push(
      supabase
        .from('repair_bookings')
        .select('*')
        .eq('email', userEmail)
        .order('created_at', { ascending: false })
    );
  }

  if (profilePhone) {
    queries.push(
      supabase
        .from('repair_bookings')
        .select('*')
        .eq('phone', profilePhone)
        .order('created_at', { ascending: false })
    );
  }

  const results = await Promise.all(queries);
  const bookingsMap = new Map();

  results.forEach((result) => {
    (result.data || []).forEach((booking) => {
      bookingsMap.set(booking.id, booking);
    });
  });

  return {
    bookings: [...bookingsMap.values()].sort(
      (first, second) =>
        new Date(second.created_at || 0).getTime() - new Date(first.created_at || 0).getTime()
    ),
    error: results.some((result) => result.error),
  };
}

/**
 * Loads the full dashboard orders snapshot for the authenticated user.
 *
 * @returns {Promise<{
 *   isAuthenticated: boolean,
 *   profile: { full_name?: string, phone?: string } | null,
 *   productOrders: Array<Record<string, unknown>>,
 *   serviceOrders: Array<Record<string, unknown>>,
 *   repairBookings: Array<Record<string, unknown>>,
 *   orderItemsMap: Record<string, Array<Record<string, unknown>>>,
 *   error: string
 * }>}
 */
export async function loadDashboardOrdersSnapshot() {
  const identity = await getDashboardOrdersIdentity();

  if (!identity.user) {
    return {
      isAuthenticated: false,
      profile: null,
      productOrders: [],
      serviceOrders: [],
      repairBookings: [],
      orderItemsMap: {},
      error: '',
    };
  }

  const [productOrdersSnapshot, digitalOrdersSnapshot, repairBookingsSnapshot] = await Promise.all([
    getProductOrdersSnapshot(identity.user.id),
    getDigitalOrdersSnapshot(identity.user.id),
    getRepairBookingsSnapshot({
      userId: identity.user.id,
      userEmail: identity.userEmail,
      profilePhone: identity.profilePhone,
    }),
  ]);

  const partialErrors = [
    productOrdersSnapshot.error ? 'تعذر تحميل طلبات المنتجات' : '',
    digitalOrdersSnapshot.error ? 'تعذر تحميل الطلبات الرقمية' : '',
    repairBookingsSnapshot.error ? 'تعذر تحميل بعض حجوزات الصيانة' : '',
  ].filter(Boolean);

  return {
    isAuthenticated: true,
    profile: identity.profile,
    productOrders: productOrdersSnapshot.orders,
    serviceOrders: digitalOrdersSnapshot.orders,
    repairBookings: repairBookingsSnapshot.bookings,
    orderItemsMap: productOrdersSnapshot.orderItemsMap,
    error: partialErrors.join('، '),
  };
}

/**
 * Subscribes to the tables that affect the dashboard orders screen.
 *
 * @param {() => void} onChange
 * @returns {() => void}
 */
export function subscribeToDashboardOrders(onChange) {
  const channels = [
    supabase
      .channel('dashboard-orders-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onChange)
      .subscribe(),
    supabase
      .channel('dashboard-orders-digital')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_orders' }, onChange)
      .subscribe(),
    supabase
      .channel('dashboard-orders-repairs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repair_bookings' }, onChange)
      .subscribe(),
  ];

  return () => {
    channels.forEach((channel) => supabase.removeChannel(channel));
  };
}
