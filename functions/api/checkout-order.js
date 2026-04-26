/**
 * Checkout order persistence and provider-sync helpers.
 */

const DEFAULT_DELIVERY_METHODS = Object.freeze([
  { value: "delivery", label: "ØªÙˆØµÙŠÙ„", fee: 2 },
  { value: "pickup", label: "Ø§Ø³ØªÙ„Ø§Ù…", fee: 0 },
]);

/**
 * Calculates the delivery fee for the selected delivery method.
 *
 * @param {string} deliveryMethod
 * @param {Array<{ value: string, fee?: number }>} deliveryMethods
 * @returns {number}
 */
function getShippingFee(deliveryMethod, deliveryMethods) {
  const matchedMethod = deliveryMethods.find((entry) => entry.value === deliveryMethod);
  return Number(matchedMethod?.fee) || 0;
}

/**
 * Resolves the delivery methods snapshot from settings storage.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @returns {Promise<Array<{ value: string, label?: string, fee?: number }>>}
 */
async function loadDeliveryMethods(admin) {
  const { data: settingsRow } = await admin.from("settings").select("data").limit(1).maybeSingle();
  return Array.isArray(settingsRow?.data?.deliveryMethods)
    ? settingsRow.data.deliveryMethods
    : [...DEFAULT_DELIVERY_METHODS];
}

/**
 * Loads an order item snapshot row and merges provider metadata into it.
 *
 * @param {{
 *   admin: import('@supabase/supabase-js').SupabaseClient,
 *   orderId: string,
 *   productId: string,
 *   snapshotUpdate: Record<string, unknown>,
 * }} input
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function updateProviderOrderSnapshot({ admin, orderId, productId, snapshotUpdate }) {
  const { data: currentItem, error: currentItemError } = await admin
    .from("order_items")
    .select("id, snapshot")
    .eq("order_id", orderId)
    .eq("product_id", productId)
    .limit(1)
    .maybeSingle();

  if (currentItemError || !currentItem?.id) {
    throw new Error("[CHK-113] ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø¹Ù†ØµØ± Ø§Ù„Ø·Ù„Ø¨ Ù„ØªØ­Ø¯ÙŠØ« Ø­Ø§Ù„Ø© Ø§Ù„Ù…Ø²ÙˆØ¯");
  }

  const { error: snapshotUpdateError } = await admin
    .from("order_items")
    .update({
      snapshot: { ...(currentItem.snapshot || {}), ...snapshotUpdate },
    })
    .eq("id", currentItem.id);

  if (snapshotUpdateError) {
    throw new Error("[CHK-114] ØªØ¹Ø°Ø± Ø­ÙØ¸ Ø­Ø§Ù„Ø© Ø·Ù„Ø¨ Ø§Ù„Ù…Ø²ÙˆØ¯");
  }
}

/**
 * Builds the provider fields payload from the service definition.
 *
 * @param {{ providerFields: Array<Record<string, unknown>>, providerLink: string }} input
 * @returns {Record<string, string> | null}
 */
function buildProviderFields({ providerFields, providerLink }) {
  const dynamicFields = {};

  for (const fieldDef of providerFields) {
    const fieldKey = fieldDef.key || fieldDef.label || "";
    if (fieldKey) {
      dynamicFields[fieldKey] = providerLink;
    }
  }

  return Object.keys(dynamicFields).length > 0 ? dynamicFields : null;
}

/**
 * Detects whether provider field metadata expects a contact handle rather than a plain phone fallback.
 *
 * @param {Array<Record<string, unknown>>} providerFields
 * @returns {boolean}
 */
function providerFieldsRequireDedicatedContact(providerFields) {
  return (Array.isArray(providerFields) ? providerFields : []).some((field) => {
    const metadataText = [
      field?.key,
      field?.label,
      field?.name,
      field?.type,
      field?.placeholder,
    ]
      .map((value) => String(value || "").trim().toLowerCase())
      .join(" ");

    return /whatsapp|phone|mobile|contact|link|profile|username|user/.test(metadataText);
  });
}

/**
 * Resolves the provider contact value required for a digital service order.
 *
 * @param {{
 *   customerContactLink: string,
 *   customerPhone: string,
 *   product: Record<string, unknown>,
 * }} input
 * @returns {string}
 */
function resolveProviderContactValue({ customerContactLink, customerPhone, product }) {
  const providerFields = Array.isArray(product?.provider_fields) ? product.provider_fields : [];
  const requiresDedicatedContact =
    product?.link_required || providerFieldsRequireDedicatedContact(providerFields);

  if (requiresDedicatedContact) {
    return customerContactLink;
  }

  return customerContactLink || customerPhone;
}

/**
 * Creates the checkout order and persists the associated order items.
 *
 * @param {{
 *   admin: import('@supabase/supabase-js').SupabaseClient,
 *   customerContactLink: string,
 *   customerEmail: string,
 *   customerName: string,
 *   customerPhone: string,
 *   deliveryMethod: string,
 *   notes: string,
 *   orderItems: Array<Record<string, unknown>>,
 *   paymentMethod: string,
 *   subtotal: number,
 *   userId: string | null,
 * }} input
 * @returns {Promise<{ orderId: string, total: number }>}
 * @throws {Error}
 */
export async function createCheckoutOrderRecord({
  admin,
  customerEmail,
  customerName,
  customerPhone,
  deliveryMethod,
  notes,
  orderItems,
  paymentMethod,
  subtotal,
  userId,
}) {
  const deliveryMethods = await loadDeliveryMethods(admin);
  if (!deliveryMethods.some((entry) => entry.value === deliveryMethod)) {
    throw new Error("[CHK-108] Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„ØªØ³Ù„ÙŠÙ… ØºÙŠØ± ØµØ§Ù„Ø­Ø©");
  }

  const shippingFee = getShippingFee(deliveryMethod, deliveryMethods);
  const total = subtotal + shippingFee;
  const { data: orderRow, error: orderError } = await admin
    .from("orders")
    .insert([
      {
        user_id: userId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        subtotal,
        total,
        status: "pending",
        delivery_method: deliveryMethod,
        payment_method: paymentMethod,
        shipping_fee: shippingFee,
        notes: notes || null,
      },
    ])
    .select("id")
    .single();

  if (orderError || !orderRow) {
    throw new Error(
      `[CHK-109] ØªØ¹Ø°Ø± Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ø·Ù„Ø¨: ${orderError?.message || "Ø®Ø·Ø£ ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ"}`
    );
  }

  const orderId = orderRow.id;
  const { error: itemsError } = await admin
    .from("order_items")
    .insert(orderItems.map((item) => ({ order_id: orderId, ...item })));

  if (itemsError) {
    await admin.from("orders").delete().eq("id", orderId);
    throw new Error(
      `[CHK-110] ØªØ¹Ø°Ø± Ø­ÙØ¸ Ø¹Ù†Ø§ØµØ± Ø§Ù„Ø·Ù„Ø¨: ${itemsError?.message || "Ø®Ø·Ø£ ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ"}`
    );
  }

  return { orderId, total };
}

/**
 * Synchronizes provider-backed service items after the local order is created.
 *
 * @param {{
 *   admin: import('@supabase/supabase-js').SupabaseClient,
 *   createProviderOrderImpl: (env: Record<string, string>, payload: Record<string, unknown>) => Promise<{ success: boolean, orderId?: string, error?: string }>,
 *   customerContactLink: string,
 *   customerPhone: string,
 *   env: Record<string, string>,
 *   items: Array<{ id: string, qty: number }>,
 *   orderId: string,
 *   productMap: Map<string, Record<string, unknown>>,
 * }} input
 * @returns {Promise<void>}
 * @throws {Error}
 */
export async function syncCheckoutProviderOrders({
  admin,
  createProviderOrderImpl,
  customerContactLink,
  customerPhone,
  env,
  items,
  orderId,
  productMap,
}) {
  for (const item of items) {
    const product = productMap.get(item.id);
    if (!product || !item.id.startsWith("srv-") || !product.provider_service_id) {
      continue;
    }

    const providerLink = resolveProviderContactValue({
      customerContactLink,
      customerPhone,
      product,
    });
    const providerFields = buildProviderFields({
      providerFields: Array.isArray(product.provider_fields) ? product.provider_fields : [],
      providerLink,
    });
    const providerResult = await createProviderOrderImpl(env, {
      serviceId: product.provider_service_id,
      quantity: item.qty,
      link: providerLink,
      fields: providerFields,
    });
    const snapshotUpdate =
      providerResult.success && providerResult.orderId
        ? { provider_order_id: providerResult.orderId, provider_status: "processing" }
        : {
            provider_error: providerResult.error,
            provider_attempted_at: new Date().toISOString(),
          };

    await updateProviderOrderSnapshot({
      admin,
      orderId,
      productId: item.id,
      snapshotUpdate,
    });
  }
}

/**
 * Sends the post-checkout success notification when a user is signed in.
 *
 * @param {{
 *   admin: import('@supabase/supabase-js').SupabaseClient,
 *   orderId: string,
 *   orderItemsCount: number,
 *   total: number,
 *   userId: string | null,
 * }} input
 * @returns {Promise<void>}
 */
export async function sendCheckoutNotification({
  admin,
  orderId,
  orderItemsCount,
  total,
  userId,
}) {
  if (!userId) {
    return;
  }

  await admin.from("notifications").insert([
    {
      user_id: userId,
      title: "ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ø·Ù„Ø¨Ùƒ Ø¨Ù†Ø¬Ø§Ø­",
      body: `Ø·Ù„Ø¨ #${orderId} â€” ${orderItemsCount} Ù…Ù†ØªØ¬ â€” Ø§Ù„Ù…Ø¨Ù„Øº: ${total.toFixed(2)} Ø¯.Ø£`,
      type: "success",
      reference_type: "order",
      reference_id: orderId,
    },
  ]);
}
