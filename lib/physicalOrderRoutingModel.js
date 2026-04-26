/**
 * Physical order routing model.
 *
 * With the accessories section removed, all physical orders
 * are classified as standard product orders.
 */

export const PRODUCT_ORDER_KIND = "products";
export const PRODUCT_ORDERS_SECTION_ID = "product-orders";

/**
 * Classifies a physical order. With accessories removed, all orders
 * are standard product orders.
 *
 * @returns {"products"}
 */
export function getPhysicalOrderKindFromProducts() {
  return PRODUCT_ORDER_KIND;
}

/**
 * Maps an order kind to its admin section identifier.
 *
 * @returns {"product-orders"}
 */
export function getPhysicalOrderSectionId() {
  return PRODUCT_ORDERS_SECTION_ID;
}
