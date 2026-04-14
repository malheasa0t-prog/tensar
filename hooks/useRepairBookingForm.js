"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildRepairBookingPayload,
  createRepairBookingFormState,
  resolveRepairDeliveryOptions,
  validateRepairBookingForm,
} from "@/lib/repairBookingModel.mjs";
import {
  createRepairBooking,
  createRepairBookingId,
  getRepairBookingAccountSnapshot,
} from "@/services/repairBookingService";

/**
 * @typedef {Object} RepairBookingFormState
 * @property {string} name
 * @property {string} phone
 * @property {string} serviceId
 * @property {string} description
 * @property {string} mode
 * @property {string} address
 */

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
    () => resolveRepairDeliveryOptions(deliveryMethods),
    [deliveryMethods]
  );
  const [form, setForm] = useState(() =>
    createRepairBookingFormState({
      services,
      deliveryOptions,
    })
  );
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
    setForm((prev) => ({
      ...prev,
      [name]: value,
      address: name === "mode" && value !== "delivery" ? "" : prev.address,
    }));
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

    const payload = buildRepairBookingPayload({
      bookingId: createRepairBookingId(),
      form,
      selectedService,
    });
    const response = await createRepairBooking(payload, currentUserId);

    setLoading(false);

    if (response.error) {
      setError("تعذر إرسال الطلب حالياً. حاول مرة أخرى.");
      return;
    }

    setMessage("تم إرسال طلب الصيانة بنجاح. سنتواصل معك قريباً.");
    setForm(
      createRepairBookingFormState({
        services,
        deliveryOptions,
        preservedValues: isAccountPrefilled
          ? {
              name: form.name,
              phone: form.phone,
            }
          : {},
      })
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
