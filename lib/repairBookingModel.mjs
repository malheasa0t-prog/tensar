import { DEFAULT_DELIVERY_METHODS } from './contactChannels/defaults.js';

const REQUIRED_REPAIR_DELIVERY_OPTIONS = [
  ...DEFAULT_DELIVERY_METHODS,
  { value: 'remote', label: 'صيانة عن بعد' },
];

/**
 * Creates the base repair booking form state while preserving trusted values.
 *
 * @param {{
 *   services?: Array<{ id?: string }>,
 *   deliveryOptions?: Array<{ value?: string }>,
 *   preservedValues?: Partial<{
 *     name: string,
 *     phone: string,
 *     serviceId: string,
 *     description: string,
 *     mode: string,
 *     address: string,
 *   }>,
 * }} params
 * @returns {{
 *   name: string,
 *   phone: string,
 *   serviceId: string,
 *   description: string,
 *   mode: string,
 *   address: string,
 * }}
 */
export function createRepairBookingFormState({
  services = [],
  deliveryOptions = [],
  preservedValues = {},
}) {
  return {
    name: preservedValues.name || '',
    phone: preservedValues.phone || '',
    serviceId: preservedValues.serviceId || services[0]?.id || '',
    description: preservedValues.description || '',
    mode: preservedValues.mode || deliveryOptions[0]?.value || 'delivery',
    address: preservedValues.address || '',
  };
}

/**
 * Ensures repair delivery options always expose the supported core modes.
 *
 * @param {Array<{ value?: string, label?: string }>} [deliveryMethods]
 * @returns {Array<{ value: string, label: string }>}
 */
export function resolveRepairDeliveryOptions(deliveryMethods = []) {
  const baseOptions =
    Array.isArray(deliveryMethods) && deliveryMethods.length > 0
      ? deliveryMethods
      : REQUIRED_REPAIR_DELIVERY_OPTIONS;
  const normalizedOptions = baseOptions
    .filter((option) => option?.value && option?.label)
    .map((option) => ({ value: String(option.value), label: String(option.label) }));

  REQUIRED_REPAIR_DELIVERY_OPTIONS.forEach((defaultOption) => {
    if (!normalizedOptions.some((option) => option.value === defaultOption.value)) {
      normalizedOptions.push({ ...defaultOption });
    }
  });

  return normalizedOptions;
}

/**
 * Determines whether the selected repair mode requires a physical address.
 *
 * @param {string} mode
 * @returns {boolean}
 */
export function isRepairAddressRequired(mode) {
  return mode === 'delivery';
}

/**
 * Builds the helper text shown beneath the repair mode selector.
 *
 * @param {string} mode
 * @returns {string}
 */
export function getRepairModeHelper(mode) {
  const modeMessages = {
    delivery: 'سننسق معك لاستلام الجهاز من العنوان الذي تكتبه هنا.',
    pickup: 'ستحضر الجهاز إلى المحل، لذلك لا نحتاج عنواناً داخل الطلب.',
    remote: 'تتم الصيانة عن بعد عبر التواصل المباشر، ولا تحتاج إلى عنوان أو تسليم جهاز.',
  };

  return modeMessages[mode] || 'اختر الطريقة الأنسب حتى نرتب الطلب بالشكل الصحيح.';
}

/**
 * Validates the repair booking form before submission.
 *
 * @param {{
 *   name: string,
 *   phone: string,
 *   serviceId: string,
 *   mode: string,
 *   address: string,
 * }} form
 * @returns {string}
 */
export function validateRepairBookingForm(form) {
  if (!form.name.trim() || !form.phone.trim() || !form.serviceId) {
    return 'يرجى تعبئة الحقول المطلوبة.';
  }

  if (isRepairAddressRequired(form.mode) && !form.address.trim()) {
    return 'يرجى إدخال عنوان الاستلام عند اختيار التوصيل.';
  }

  return '';
}

/**
 * Builds the normalized repair booking payload expected by Supabase.
 *
 * @param {{
 *   bookingId: string,
 *   form: {
 *     name: string,
 *     phone: string,
 *     serviceId: string,
 *     description: string,
 *     mode: string,
 *     address: string,
 *   },
 *   selectedService?: { name?: string },
 * }} params
 * @returns {Record<string, unknown>}
 */
export function buildRepairBookingPayload({ bookingId, form, selectedService }) {
  return {
    id: bookingId,
    name: form.name.trim(),
    phone: form.phone.trim(),
    service_id: form.serviceId,
    service_name: selectedService?.name || 'خدمة صيانة',
    device: null,
    description: form.description.trim() || null,
    preferred_date: null,
    mode: form.mode,
    address: isRepairAddressRequired(form.mode) ? form.address.trim() : null,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
}
