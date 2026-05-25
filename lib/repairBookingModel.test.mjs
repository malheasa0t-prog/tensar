import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRepairBookingPayload,
  createRepairBookingFormState,
  getRepairModeHelper,
  resolveRepairBookingServiceId,
  resolveRepairDeliveryOptions,
  validateRepairBookingForm,
} from './repairBookingModel.mjs';

test('resolveRepairDeliveryOptions should append remote mode when missing from stored settings', () => {
  const options = resolveRepairDeliveryOptions([
    { value: 'delivery', label: 'توصيل' },
    { value: 'pickup', label: 'استلام من المحل' },
  ]);

  assert.deepEqual(
    options.map((option) => option.value),
    ['delivery', 'pickup', 'remote']
  );
});

test('createRepairBookingFormState should preserve trusted values and use first valid defaults', () => {
  const state = createRepairBookingFormState({
    services: [{ id: 'service-1' }, { id: 'service-2' }],
    deliveryOptions: [{ value: 'pickup' }, { value: 'remote' }],
    preservedValues: { name: 'محمد', phone: '079', mode: 'remote' },
  });

  assert.deepEqual(state, {
    name: 'محمد',
    phone: '079',
    serviceId: 'service-1',
    description: '',
    mode: 'remote',
    address: '',
  });
});

test('resolveRepairBookingServiceId should prefer a valid requested service id', () => {
  assert.equal(
    resolveRepairBookingServiceId({
      services: [{ id: 'service-1' }, { id: 'service-2' }],
      requestedServiceId: 'service-2',
      currentServiceId: 'service-1',
    }),
    'service-2'
  );
});

test('resolveRepairBookingServiceId should keep the current service when request is invalid', () => {
  assert.equal(
    resolveRepairBookingServiceId({
      services: [{ id: 'service-1' }, { id: 'service-2' }],
      requestedServiceId: 'missing-service',
      currentServiceId: 'service-1',
    }),
    'service-1'
  );
});

test('resolveRepairBookingServiceId should fall back to the first service when needed', () => {
  assert.equal(
    resolveRepairBookingServiceId({
      services: [{ id: 'service-1' }],
      requestedServiceId: '',
      currentServiceId: '',
    }),
    'service-1'
  );

  assert.equal(resolveRepairBookingServiceId({ services: [] }), '');
});

test('validateRepairBookingForm should return coded errors for missing required fields', () => {
  assert.equal(
    validateRepairBookingForm({
      name: '',
      phone: '0777777777',
      serviceId: 'svc',
      mode: 'delivery',
      address: 'عمان',
    }),
    '[RBK-101] يرجى تعبئة الحقول المطلوبة.'
  );
});

test('validateRepairBookingForm should require address only for delivery mode', () => {
  assert.equal(
    validateRepairBookingForm({
      name: 'أحمد',
      phone: '0777777777',
      serviceId: 'svc',
      mode: 'delivery',
      address: '',
    }),
    '[RBK-102] يرجى إدخال عنوان الاستلام عند اختيار التوصيل.'
  );

  assert.equal(
    validateRepairBookingForm({
      name: 'أحمد',
      phone: '0777777777',
      serviceId: 'svc',
      mode: 'remote',
      address: '',
    }),
    ''
  );
});

test('buildRepairBookingPayload should omit address when repair is remote', () => {
  const payload = buildRepairBookingPayload({
    bookingId: 'bk-123',
    form: {
      name: '  أحمد  ',
      phone: ' 0777777777 ',
      serviceId: 'svc-1',
      description: ' تثبيت برامج ',
      mode: 'remote',
      address: 'عمّان',
    },
    selectedService: { name: 'تنصيب وبرمجة' },
  });

  assert.equal(payload.id, 'bk-123');
  assert.equal(payload.name, 'أحمد');
  assert.equal(payload.phone, '0777777777');
  assert.equal(payload.service_name, 'تنصيب وبرمجة');
  assert.equal(payload.address, null);
  assert.equal(payload.email, undefined);
});

test('getRepairModeHelper should explain remote maintenance clearly', () => {
  assert.match(getRepairModeHelper('remote'), /عن بعد/);
});

test('validateRepairBookingForm should reject malformed phone numbers', () => {
  assert.equal(
    validateRepairBookingForm({
      name: 'أحمد',
      phone: '077',
      serviceId: 'svc',
      mode: 'remote',
      address: '',
    }),
    '[RBK-103] رقم الهاتف غير صالح.'
  );
});

test('validateRepairBookingForm should reject past preferred dates', () => {
  assert.equal(
    validateRepairBookingForm({
      name: 'أحمد',
      phone: '0777777777',
      serviceId: 'svc',
      mode: 'remote',
      address: '',
      preferredDate: '2020-01-01',
    }),
    '[RBK-104] تاريخ الموعد يجب أن يكون اليوم أو بعد ذلك.'
  );
});

test('validateRepairBookingForm should reject unsupported repair modes', () => {
  assert.equal(
    validateRepairBookingForm({
      name: 'أحمد',
      phone: '0777777777',
      serviceId: 'svc',
      mode: 'teleport',
      address: '',
    }),
    '[RBK-105] طريقة الاستلام غير مدعومة.'
  );
});

test('buildRepairBookingPayload should throw when the form fails validation', () => {
  assert.throws(
    () => buildRepairBookingPayload({
      bookingId: 'bk-fail',
      form: {
        name: 'أحمد',
        phone: 'invalid',
        serviceId: 'svc-1',
        description: '',
        mode: 'remote',
        address: '',
      },
      selectedService: { name: 'خدمة' },
    }),
    /\[RBK-103\]/
  );
});
