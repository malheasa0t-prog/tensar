import { DEFAULT_DELIVERY_METHODS } from './contactChannels/defaults.js';

const REQUIRED_FIELDS_ERROR = '[RBK-101] يرجى تعبئة الحقول المطلوبة.';
const DELIVERY_ADDRESS_ERROR = '[RBK-102] يرجى إدخال عنوان الاستلام عند اختيار التوصيل.';
const INVALID_PHONE_ERROR = '[RBK-103] رقم الهاتف غير صالح.';
const INVALID_DATE_ERROR = '[RBK-104] تاريخ الموعد يجب أن يكون اليوم أو بعد ذلك.';
const INVALID_MODE_ERROR = '[RBK-105] طريقة الاستلام غير مدعومة.';
const NAME_LENGTH_ERROR = '[RBK-106] الاسم يجب أن يكون بين 2 و 120 محرفا.';
const DESCRIPTION_LENGTH_ERROR = '[RBK-107] الوصف يجب ألا يتجاوز 2000 محرف.';
const REPAIR_PHONE_PATTERN = /^[+0-9\s()-]{7,20}$/;
const ALLOWED_REPAIR_MODES = Object.freeze(['delivery', 'pickup', 'remote']);
const MAX_REPAIR_DESCRIPTION_LENGTH = 2000;
const MAX_REPAIR_NAME_LENGTH = 120;
const MIN_REPAIR_NAME_LENGTH = 2;
const UNKNOWN_REPAIR_DEVICE_LABEL = 'غير محدد';
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
 * Resolves the service id that should be selected inside the repair form.
 *
 * @param {{
 *   services?: Array<{ id?: string }>,
 *   requestedServiceId?: string,
 *   currentServiceId?: string,
 * }} params
 * @returns {string}
 */
export function resolveRepairBookingServiceId({
  services = [],
  requestedServiceId = '',
  currentServiceId = '',
}) {
  const serviceIds = (Array.isArray(services) ? services : [])
    .map((service) => String(service?.id || '').trim())
    .filter(Boolean);
  const requestedId = String(requestedServiceId || '').trim();
  const currentId = String(currentServiceId || '').trim();

  if (requestedId && serviceIds.includes(requestedId)) return requestedId;
  if (currentId && serviceIds.includes(currentId)) return currentId;
  return serviceIds[0] || '';
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
    pickup: 'ستحضر الجهاز إلى المحل، لذلك لا نحتاج عنوانًا داخل الطلب.',
    remote: 'تتم الصيانة عن بعد عبر التواصل المباشر، ولا تحتاج إلى عنوان أو تسليم جهاز.',
  };

  return modeMessages[mode] || 'اختر الطريقة الأنسب حتى نرتب الطلب بالشكل الصحيح.';
}

/**
 * Validates the repair booking form before submission.
 *
 * Runs the same checks the server applies in `buildRepairBookingPayload`, so
 * the user sees inline errors before submitting. The server still re-runs
 * every check — these client-side messages are UX only and never the source
 * of trust.
 *
 * @param {{
 *   name?: string,
 *   phone?: string,
 *   serviceId?: string,
 *   description?: string,
 *   mode?: string,
 *   address?: string,
 *   preferredDate?: string,
 * }} form - Form snapshot to validate.
 * @returns {string} Empty string when valid, error code otherwise.
 */
export function validateRepairBookingForm(form) {
  const name = String(form?.name || '').trim();
  const phone = String(form?.phone || '').trim();
  const serviceId = String(form?.serviceId || '').trim();
  const mode = String(form?.mode || '').trim();
  const address = String(form?.address || '').trim();
  const description = String(form?.description || '').trim();
  const preferredDate = String(form?.preferredDate || '').trim();

  if (!name || !phone || !serviceId) {
    return REQUIRED_FIELDS_ERROR;
  }
  if (name.length < MIN_REPAIR_NAME_LENGTH || name.length > MAX_REPAIR_NAME_LENGTH) {
    return NAME_LENGTH_ERROR;
  }
  if (!REPAIR_PHONE_PATTERN.test(phone)) {
    return INVALID_PHONE_ERROR;
  }
  if (description.length > MAX_REPAIR_DESCRIPTION_LENGTH) {
    return DESCRIPTION_LENGTH_ERROR;
  }
  if (mode && !ALLOWED_REPAIR_MODES.includes(mode)) {
    return INVALID_MODE_ERROR;
  }
  if (isRepairAddressRequired(mode) && !address) {
    return DELIVERY_ADDRESS_ERROR;
  }
  if (preferredDate && !isFutureOrTodayDate(preferredDate)) {
    return INVALID_DATE_ERROR;
  }

  return '';
}

/**
 * Returns true when the supplied date string is today or later.
 *
 * Accepts both ISO timestamps and `YYYY-MM-DD` dates. Invalid input fails
 * closed (returns false) so the validator surfaces the same error message.
 *
 * @param {string} value - Candidate date string.
 * @returns {boolean} True when the date is today or in the future.
 */
export function isFutureOrTodayDate(value) {
  const parsed = new Date(String(value || '').trim());
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return parsed.getTime() >= startOfToday.getTime();
}

/**
 * Resolves the stored device label for legacy repair booking rows.
 *
 * The current public form no longer requires a dedicated device field, but
 * the production table still marks `device` as mandatory. We keep any future
 * caller-supplied value and otherwise fall back to a stable placeholder.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
function resolveRepairBookingDevice(value) {
  const trimmedValue = String(value || '').trim();
  return trimmedValue || UNKNOWN_REPAIR_DEVICE_LABEL;
}

/**
 * Builds the normalized repair booking payload expected by Supabase.
 *
 * Re-runs the same validation as `validateRepairBookingForm` and throws when
 * the form is invalid, so the repair booking service can never persist a
 * booking with an invalid phone or a past date even if a client bypasses the
 * form-level check.
 *
 * @param {{
 *   bookingId: string,
 *   form: {
 *     name: string,
 *     phone: string,
 *     serviceId: string,
 *     device?: string,
 *     description?: string,
 *     mode: string,
 *     address?: string,
 *     preferredDate?: string,
 *   },
 *   selectedService?: { name?: string },
 * }} params - Builder input.
 * @returns {Record<string, unknown>} Insert payload.
 * @throws {Error} When the form fails validation.
 */
export function buildRepairBookingPayload({ bookingId, form, selectedService }) {
  const validationError = validateRepairBookingForm(form);
  if (validationError) {
    throw new Error(validationError);
  }

  const trimmedMode = String(form.mode || '').trim() || 'delivery';
  const trimmedDescription = String(form.description || '').trim();
  const trimmedAddress = String(form.address || '').trim();
  const trimmedPreferredDate = String(form.preferredDate || '').trim();

  return {
    id: bookingId,
    name: form.name.trim(),
    phone: form.phone.trim(),
    service_id: form.serviceId,
    service_name: selectedService?.name || 'خدمة صيانة',
    device: resolveRepairBookingDevice(form.device),
    description: trimmedDescription,
    preferred_date: trimmedPreferredDate || null,
    mode: trimmedMode,
    address: isRepairAddressRequired(trimmedMode) ? trimmedAddress : null,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
}
