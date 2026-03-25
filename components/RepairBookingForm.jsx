"use client";

import RepairBookingCustomerFields from "@/components/repair-booking/RepairBookingCustomerFields";
import RepairBookingFormFeedback from "@/components/repair-booking/RepairBookingFormFeedback";
import RepairBookingHeader from "@/components/repair-booking/RepairBookingHeader";
import RepairBookingServiceFields from "@/components/repair-booking/RepairBookingServiceFields";
import { useRepairBookingForm } from "@/hooks/useRepairBookingForm";

/**
 * Coordinates the repair booking experience while delegating business logic and data access.
 *
 * @param {{ services?: Array<{ id?: string, name?: string, price?: number | string }>, deliveryMethods?: Array<{ value?: string, label?: string }> }} props
 * @returns {JSX.Element}
 */
export default function RepairBookingForm({ services = [], deliveryMethods = [] }) {
  const {
    form,
    deliveryOptions,
    loading,
    message,
    error,
    isAccountPrefilled,
    handleFieldChange,
    handleSubmit,
  } = useRepairBookingForm({
    services,
    deliveryMethods,
  });

  return (
    <div className="repair-form-card">
      <RepairBookingHeader isAccountPrefilled={isAccountPrefilled} />

      <form className="repair-form" onSubmit={handleSubmit}>
        <RepairBookingCustomerFields form={form} onChange={handleFieldChange} />
        <RepairBookingServiceFields
          form={form}
          services={services}
          deliveryOptions={deliveryOptions}
          onChange={handleFieldChange}
        />
        <RepairBookingFormFeedback error={error} message={message} />

        <button type="submit" disabled={loading}>
          {loading ? "جاري الإرسال..." : "إرسال طلب الصيانة"}
        </button>
      </form>
    </div>
  );
}
