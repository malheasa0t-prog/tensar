import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateCheckoutItems,
  calculateCheckoutTotals,
  createCheckoutFormState,
  getWalletTransferInstructions,
  getInitialPhysicalOrderStatus,
  resolveDeliveryMethodFee,
  syncCheckoutSelections,
} from './checkoutModel.js';
import { formatCurrency } from './formatCurrency.js';

test('createCheckoutFormState should initialize customer data without email field', () => {
  const form = createCheckoutFormState({
    paymentMethods: [{ value: 'cod' }],
    deliveryMethods: [{ value: 'delivery' }],
  });

  assert.deepEqual(form, {
    customer_name: '',
    customer_phone: '',
    customer_contact_link: '',
    notes: '',
    coupon_code: '',
    payment_method: 'cod',
    delivery_method: 'delivery',
  });
  assert.equal(Object.hasOwn(form, 'customer_email'), false);
});

test('syncCheckoutSelections should preserve valid selected methods', () => {
  const form = syncCheckoutSelections({
    form: {
      customer_name: 'Ali',
      customer_phone: '0799999999',
      notes: 'Ring the bell',
      payment_method: 'wallet',
      delivery_method: 'pickup',
    },
    paymentMethods: [{ value: 'wallet' }, { value: 'cod' }],
    deliveryMethods: [{ value: 'pickup' }, { value: 'delivery' }],
  });

  assert.equal(form.payment_method, 'wallet');
  assert.equal(form.delivery_method, 'pickup');
  assert.equal(form.customer_name, 'Ali');
});

test('syncCheckoutSelections should fall back to first available methods when selection is stale', () => {
  const form = syncCheckoutSelections({
    form: {
      customer_name: 'Ali',
      customer_phone: '0799999999',
      notes: '',
      payment_method: 'legacy',
      delivery_method: 'legacy',
    },
    paymentMethods: [{ value: 'cod' }],
    deliveryMethods: [{ value: 'delivery' }],
  });

  assert.equal(form.payment_method, 'cod');
  assert.equal(form.delivery_method, 'delivery');
});

test('getWalletTransferInstructions should return wallet number and amount for wallet payments', () => {
  assert.deepEqual(
    getWalletTransferInstructions({
      paymentMethod: 'wallet',
      walletTransferNumber: '0791234567',
      total: 12.5,
    }),
    {
      amountText: formatCurrency(12.5),
      walletNumber: '0791234567',
    }
  );
});

test('getWalletTransferInstructions should return null when wallet number is missing', () => {
  assert.equal(
    getWalletTransferInstructions({
      paymentMethod: 'wallet',
      walletTransferNumber: '',
      total: 12.5,
    }),
    null
  );
});

test('resolveDeliveryMethodFee should return the selected method fee', () => {
  const shippingFee = resolveDeliveryMethodFee({
    deliveryMethod: 'delivery',
    deliveryMethods: [
      { value: 'delivery', fee: 3.5 },
      { value: 'pickup', fee: 0 },
    ],
  });

  assert.equal(shippingFee, 3.5);
});

test('calculateCheckoutTotals should add the selected delivery fee to the subtotal', () => {
  const totals = calculateCheckoutTotals({
    subtotal: 20,
    deliveryMethod: 'delivery',
    deliveryMethods: [
      { value: 'delivery', fee: 2.25 },
      { value: 'pickup', fee: 0 },
    ],
  });

  assert.deepEqual(totals, {
    shippingFee: 2.25,
    total: 22.25,
  });
});

test('aggregateCheckoutItems should merge duplicate product rows before validation', () => {
  const items = aggregateCheckoutItems([
    { id: 'gpu-1', qty: 2 },
    { id: 'gpu-1', qty: 1 },
    { id: 'ssd-1', qty: 3 },
  ]);

  assert.deepEqual(items, [
    { id: 'gpu-1', qty: 3 },
    { id: 'ssd-1', qty: 3 },
  ]);
});

test('getInitialPhysicalOrderStatus should start new orders as pending', () => {
  assert.equal(getInitialPhysicalOrderStatus(), 'pending');
});
