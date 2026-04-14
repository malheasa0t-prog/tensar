import { NextResponse } from 'next/server';
import { validateCartChange } from '@/lib/cartAvailabilityModel';
import {
  aggregateCheckoutItems,
  calculateCheckoutTotals,
  getInitialPhysicalOrderStatus,
} from '@/lib/checkoutModel';
import { normalizeSiteSettings } from '@/lib/contactChannels';
import { getPhysicalOrderKindFromProducts } from '@/lib/physicalOrderRoutingModel';
import { supabaseAdmin, supabaseServer } from '@/lib/supabaseServer';
import {
  applyInventoryAdjustments,
  buildInventoryAdjustments,
  INVENTORY_CONFLICT_ERROR_MESSAGE,
} from '@/services/checkoutInventoryService';
import {
  CHECKOUT_ROLLBACK_ERROR_MESSAGE,
  rollbackCheckoutState,
} from '@/services/checkoutRollbackService';
import {
  BANNED_ACCOUNT_MESSAGE,
  extractBearerToken,
  getOptionalUserAccessState,
} from '@/services/userAccessService';

export const runtime = 'nodejs';

/**
 * Returns a trimmed string or an empty string for invalid values.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Converts a value to a positive integer when possible.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function asPositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Builds a standard failed JSON response.
 *
 * @param {{ error: string, status: number }} input
 * @returns {Response}
 */
function createErrorResponse({ error, status }) {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Validates the checkout customer fields.
 *
 * @param {{ customerName: string, customerPhone: string }} input
 * @returns {Response | null}
 */
function validateCheckoutCustomer({ customerName, customerPhone }) {
  if (!customerName || customerName.length < 2 || customerName.length > 120) {
    return createErrorResponse({ error: 'الاسم غير صالح', status: 400 });
  }

  if (!/^[+0-9\s()-]{7,20}$/.test(customerPhone)) {
    return createErrorResponse({ error: 'رقم الهاتف غير صالح', status: 400 });
  }

  return null;
}

/**
 * Normalizes and aggregates checkout items by product identifier.
 *
 * @param {Array<unknown>} items
 * @returns {Array<{ id: string, qty: number }>}
 */
function normalizeCheckoutItems(items) {
  const normalizedItems = (Array.isArray(items) ? items : [])
    .map((item) => ({
      id: normalizeText(item?.id),
      qty: asPositiveInt(item?.qty),
    }))
    .filter((item) => item.id && item.qty);

  return aggregateCheckoutItems(normalizedItems);
}

/**
 * Loads delivery methods from site settings with a safe fallback.
 *
 * @returns {Promise<Array<{ value: string, fee?: number }>>}
 */
async function loadCheckoutDeliveryMethods() {
  const { data, error } = await supabaseAdmin.from('settings').select('data').limit(1).maybeSingle();

  if (error) {
    return normalizeSiteSettings().deliveryMethods;
  }

  return normalizeSiteSettings(data?.data).deliveryMethods;
}

/**
 * Loads category identifiers and slugs for the products in the order.
 *
 * @param {Array<unknown>} categoryIds
 * @returns {Promise<{ categories: Array<{ id: string, slug?: string }> } | { errorResponse: Response }>}
 */
async function loadCheckoutCategories(categoryIds) {
  const normalizedCategoryIds = [...new Set((Array.isArray(categoryIds) ? categoryIds : []).map(normalizeText).filter(Boolean))];
  if (normalizedCategoryIds.length === 0) {
    return { categories: [] };
  }

  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('id,slug')
    .in('id', normalizedCategoryIds);

  if (error) {
    return {
      errorResponse: createErrorResponse({
        error: 'تعذر تحميل أقسام المنتجات',
        status: 500,
      }),
    };
  }

  return {
    categories: data || [],
  };
}

/**
 * Builds validated order items and subtotal from the current catalog snapshot.
 *
 * @param {{
 *   aggregatedItems: Array<{ id: string, qty: number }>,
 *   products: Array<Record<string, unknown>>,
 *   categories: Array<{ id: string, slug?: string }>,
 * }} input
 * @returns {{ orderItems: Array<Record<string, unknown>>, subtotal: number, catalogKind: string } | { errorResponse: Response }}
 */
function buildValidatedOrderLines({ aggregatedItems, products, categories }) {
  const productMap = new Map((Array.isArray(products) ? products : []).map((product) => [product.id, product]));
  const categoryMap = new Map((Array.isArray(categories) ? categories : []).map((category) => [category.id, category]));
  const orderItems = [];
  let subtotal = 0;

  for (const item of aggregatedItems) {
    const product = productMap.get(item.id);

    if (!product) {
      return {
        errorResponse: createErrorResponse({
          error: `المنتج غير متاح: ${item.id}`,
          status: 400,
        }),
      };
    }

    const availability = validateCartChange({ product, nextQty: item.qty });
    if (!availability.ok) {
      return {
        errorResponse: createErrorResponse({
          error: `${availability.message} (${product.name})`,
          status: 400,
        }),
      };
    }

    const unitPrice = Number(product.discount_price || product.price || 0);
    subtotal += unitPrice * item.qty;
    orderItems.push({
      product_id: product.id,
      product_name: product.name,
      qty: item.qty,
      price: unitPrice,
      snapshot: {
        category_id: product.category_id || null,
        category_slug: categoryMap.get(product.category_id || '')?.slug || null,
        product_type: product.product_type || 'physical',
        brand: product.brand || null,
        image: Array.isArray(product.images) ? product.images[0] || null : null,
      },
    });
  }

  return {
    orderItems,
    subtotal,
    catalogKind: getPhysicalOrderKindFromProducts(products || [], { categories }),
  };
}

/**
 * Executes rollback side effects after a checkout persistence failure.
 *
 * @param {{
 *   orderId: string,
 *   appliedInventoryAdjustments: Array<Record<string, unknown>>,
 * }} input
 * @returns {Promise<Response | null>}
 */
async function handleRollbackFailure({ orderId, appliedInventoryAdjustments }) {
  const rollbackResult = await rollbackCheckoutState({
    orderId,
    appliedInventoryAdjustments,
    client: supabaseAdmin,
  });

  if (rollbackResult.ok) {
    return null;
  }

  console.error('Checkout rollback failed', rollbackResult);
  return createErrorResponse({
    error: CHECKOUT_ROLLBACK_ERROR_MESSAGE,
    status: 500,
  });
}

/**
 * Creates a physical checkout order.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const customerName = normalizeText(body?.customer_name);
    const customerPhone = normalizeText(body?.customer_phone);
    const customerEmail = normalizeText(body?.customer_email);
    const notes = normalizeText(body?.notes);
    const deliveryMethod = normalizeText(body?.delivery_method) || 'delivery';
    const paymentMethod = normalizeText(body?.payment_method) || 'cod';
    const customerValidationError = validateCheckoutCustomer({ customerName, customerPhone });

    if (customerValidationError) {
      return customerValidationError;
    }

    const aggregatedItems = normalizeCheckoutItems(body?.items);
    if (aggregatedItems.length === 0) {
      return createErrorResponse({ error: 'بيانات السلة غير صالحة', status: 400 });
    }

    const userAccess = await getOptionalUserAccessState({
      token: extractBearerToken(request.headers.get('authorization')),
      serverClient: supabaseServer,
      adminClient: supabaseAdmin,
    });
    if (userAccess.isBanned) {
      return createErrorResponse({ error: BANNED_ACCOUNT_MESSAGE, status: 403 });
    }

    const productIds = aggregatedItems.map((item) => item.id);
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id,name,price,discount_price,quantity,sold,status,category_id,product_type,brand,images')
      .in('id', productIds)
      .eq('status', 'active');

    if (productsError) {
      return createErrorResponse({ error: 'تعذر تحميل بيانات المنتجات', status: 500 });
    }

    const categoriesResult = await loadCheckoutCategories(
      (products || []).map((product) => product.category_id)
    );
    if ('errorResponse' in categoriesResult) {
      return categoriesResult.errorResponse;
    }

    const orderLinesResult = buildValidatedOrderLines({
      aggregatedItems,
      products: products || [],
      categories: categoriesResult.categories,
    });
    if ('errorResponse' in orderLinesResult) {
      return orderLinesResult.errorResponse;
    }

    const deliveryMethods = await loadCheckoutDeliveryMethods();
    if (!deliveryMethods.some((option) => option.value === deliveryMethod)) {
      return createErrorResponse({ error: 'طريقة التسليم غير صالحة', status: 400 });
    }

    const { shippingFee, total } = calculateCheckoutTotals({
      subtotal: orderLinesResult.subtotal,
      deliveryMethod,
      deliveryMethods,
    });
    const inventoryAdjustments = buildInventoryAdjustments({
      products: products || [],
      aggregatedItems,
    });
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const { error: orderError } = await supabaseAdmin.from('orders').insert([
      {
        id: orderId,
        user_id: userAccess.userId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        total,
        status: getInitialPhysicalOrderStatus(),
        delivery_method: deliveryMethod,
        payment_method: paymentMethod,
        shipping_fee: shippingFee,
        notes: notes || null,
        metadata: {
          catalog_kind: orderLinesResult.catalogKind,
        },
      },
    ]);

    if (orderError) {
      return createErrorResponse({ error: 'تعذر إنشاء الطلب', status: 500 });
    }

    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(
      orderLinesResult.orderItems.map((item) => ({
        order_id: orderId,
        ...item,
      }))
    );

    if (itemsError) {
      const rollbackFailureResponse = await handleRollbackFailure({
        orderId,
        appliedInventoryAdjustments: [],
      });
      return (
        rollbackFailureResponse ||
        createErrorResponse({ error: 'تعذر حفظ عناصر الطلب', status: 500 })
      );
    }

    try {
      await applyInventoryAdjustments({
        adjustments: inventoryAdjustments,
        client: supabaseAdmin,
      });
    } catch (error) {
      const rollbackFailureResponse = await handleRollbackFailure({
        orderId,
        appliedInventoryAdjustments: inventoryAdjustments,
      });

      if (rollbackFailureResponse) {
        return rollbackFailureResponse;
      }

      if (error instanceof Error && error.message === INVENTORY_CONFLICT_ERROR_MESSAGE) {
        return createErrorResponse({ error: error.message, status: 409 });
      }

      return createErrorResponse({ error: 'تعذر تحديث المخزون', status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        order_id: orderId,
        total,
        items_count: orderLinesResult.orderItems.length,
      },
    });
  } catch (error) {
    console.error('Checkout API error:', error);
    return createErrorResponse({ error: 'حدث خطأ غير متوقع', status: 500 });
  }
}
