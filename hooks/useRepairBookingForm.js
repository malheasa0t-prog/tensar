"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeSiteSettings } from "@/lib/contactChannels";
import {
  createRepairBooking,
  createRepairBookingId,
  getRepairBookingAccountSnapshot,
} from "@/services/repairBookingService";

const DEFAULT_DELIVERY_METHODS = normalizeSiteSettings().deliveryMethods;

/**
 * @typedef {Object} RepairBookingFormState
 * @property {string} name
 * @property {string} phone
 * @property {string} email
 * @property {string} serviceId
 * @property {string} description
 * @property {string} mode
 * @property {string} address
 */

/**
 * Creates the base form state while preserving any trusted prefilled values.
 *
 * @param {Array<{ id?: string }>} services
 * @param {Array<{ value?: string }>} deliveryOptions
 * @param {Partial<RepairBookingFormState>} [preservedValues]
 * @returns {RepairBookingFormState}
 */
function createRepairBookingFormState(services, deliveryOptions, preservedValues = {}) {
  return {
    name: preservedValues.name || "",
    phone: preservedValues.phone || "",
    email: preservedValues.email || "",
    serviceId: services[0]?.id || "",
    description: "",
    mode: deliveryOptions[0]?.value || "delivery",
    address: "",
  };
}

/**
 * Validates the user input before sending the booking to the backend.
 *
 * @param {RepairBookingFormState} form
 * @returns {string}
 */
function validateRepairBookingForm(form) {
  if (!form.name.trim() || !form.phone.trim() || !form.serviceId) {
    return "يرجى تعبئة الحقول المطلوبة.";
  }

  if (form.mode === "delivery" && !form.address.trim()) {
    return "يرجى إدخال العنوان عند اختيار التوصيل.";
  }

  return "";
}

/**
 * Builds the normalized payload expected by the `repair_bookings` table.
 *
 * @param {RepairBookingFormState} form
 * @param {{ name?: string } | undefined} selectedService
 * @returns {Record<string, unknown>}
 */
function buildRepairBookingPayload(form, selectedService) {
  return {
    id: createRepairBookingId(),
    name: form.name.trim(),
    phone: form.phone.trim(),
    email: form.email.trim() || null,
    service_id: form.serviceId,
    service_name: selectedService?.name || "خدمة صيانة",
    device: null,
    description: form.description.trim() || null,
    preferred_date: null,
    mode: form.mode,
    address: form.mode === "delivery" ? form.address.trim() : null,
    status: "pending",
    created_at: new Date().toISOString(),
  };
}

/**
 * Manages repair booking state, validation, account prefilling, and submission.
 *
 * @param {{ services?: Array<{ id?: string, name?: string }>, deliveryMethods?: Array<{ value?: string, label?: string }> }} params
 * @returns {{
 *   form: RepairBookingFormState,
 *   deliveryOptions: Array<{ value?: string, label?: string }>,
 *   loading: boolean,
 *   message: string,
 *   error: string,
 *   isAccountPrefilled: boolean,
 *   handleFieldChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void,
 *   handleSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
 * }}
 */
export function useRepairBookingForm({ services = [], deliveryMethods = [] }) {
  const deliveryOptions = useMemo(
    () => (deliveryMethods.length > 0 ? deliveryMethods : DEFAULT_DELIVERY_METHODS),
    [deliveryMethods]
  );
  const [form, setForm] = useState(() => createRepairBookingFormState(services, deliveryOptions));
  const [currentUserId, setCurrentUserId] = useState("");
  const [isAccountPrefilled, setIsAccountPrefilled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedService = useMemo(
    () => services.find((service) => service.id === form.serviceId),
    [services, form.serviceId]
  );

  useEffect(() => {
    if (!services.length) {
      return;
    }

    setForm((prev) =>
      services.some((service) => service.id === prev.serviceId)
        ? prev
        : { ...prev, serviceId: services[0].id }
    );
  }, [services]);

  useEffect(() => {
    if (!deliveryOptions.length) {
      return;
    }

    setForm((prev) =>
      deliveryOptions.some((option) => option.value === prev.mode)
        ? prev
        : { ...prev, mode: deliveryOptions[0].value }
    );
  }, [deliveryOptions]);

  useEffect(() => {
    let isMounted = true;

    /**
     * Loads the signed-in user snapshot without overwriting manual typing.
     *
     * @returns {Promise<void>}
     */
    async function hydrateFromAccount() {
      const accountSnapshot = await getRepairBookingAccountSnapshot();

      if (!isMounted || !accountSnapshot.userId) {
        return;
      }

      setCurrentUserId(accountSnapshot.userId);
      setIsAccountPrefilled(accountSnapshot.isAccountPrefilled);
      setForm((prev) => ({
        ...prev,
        name: prev.name || accountSnapshot.name,
        phone: prev.phone || accountSnapshot.phone,
        email: prev.email || accountSnapshot.email,
      }));
    }

    hydrateFromAccount();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Updates a single form field while keeping the rest of the state intact.
   *
   * @param {React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>} event
   * @returns {void}
   */
  function handleFieldChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  /**
   * Validates and submits the repair booking using the extracted service layer.
   *
   * @param {React.FormEvent<HTMLFormElement>} event
   * @returns {Promise<void>}
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const validationError = validateRepairBookingForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    const payload = buildRepairBookingPayload(form, selectedService);
    const response = await createRepairBooking(payload, currentUserId);

    setLoading(false);

    if (response.error) {
      setError("تعذر إرسال الطلب حاليًا. حاول مرة أخرى.");
      return;
    }

    setMessage("تم إرسال طلب الصيانة بنجاح. سنتواصل معك قريبًا.");
    setForm(
      createRepairBookingFormState(
        services,
        deliveryOptions,
        isAccountPrefilled
          ? {
              name: form.name,
              phone: form.phone,
              email: form.email,
            }
          : {}
      )
    );
  }

  return {
    form,
    deliveryOptions,
    loading,
    message,
    error,
    isAccountPrefilled,
    handleFieldChange,
    handleSubmit,
  };
}
