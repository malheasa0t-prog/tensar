"use client";

import AppIcon from "@/components/AppIcon";
import Button from "@/components/Button";
import RepairBookingCustomerFields from "@/components/repair-booking/RepairBookingCustomerFields";
import RepairBookingFormFeedback from "@/components/repair-booking/RepairBookingFormFeedback";
import RepairBookingHeader from "@/components/repair-booking/RepairBookingHeader";
import RepairBookingServiceFields from "@/components/repair-booking/RepairBookingServiceFields";
import styles from "@/components/repair-booking/RepairBookingForm.module.css";
import { useRepairBookingForm } from "@/hooks/useRepairBookingForm";

/**
 * Renders one compact booking form section with a single title.
 *
 * @param {{ title: string, children: React.ReactNode }} props
 * @returns {JSX.Element}
 */
function RepairFormSection({ title, children }) {
  return (
    <section className={styles.section}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      {children}
    </section>
  );
}

/**
 * Renders the submit area for the repair booking form.
 *
 * @param {{ loading: boolean, disabled: boolean }} props
 * @returns {JSX.Element}
 */
function RepairFormSubmitBar({ loading, disabled }) {
  return (
    <div className={styles.submitBar}>
      <Button
        type="submit"
        variant="primary"
        loading={loading}
        disabled={disabled}
        loadingLabel="جاري الإرسال..."
        fullWidth
        startIcon={<AppIcon name="send" size={16} />}
        className={styles.submitButton}
      >
        إرسال طلب الصيانة
      </Button>
    </div>
  );
}

/**
 * Renders the form sections and submission feedback.
 *
 * @param {{
 *   form: { name: string, phone: string, serviceId: string, description: string, mode: string, address: string },
 *   services: Array<{ id?: string, name?: string, price?: number | string }>,
 *   deliveryOptions: Array<{ value?: string, label?: string }>,
 *   error: string,
 *   message: string,
 *   onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
 * }} props
 * @returns {JSX.Element}
 */
function RepairFormContent({ form, services, deliveryOptions, error, message, onChange }) {
  return (
    <>
      <RepairFormSection title="بيانات التواصل">
        <RepairBookingCustomerFields form={form} onChange={onChange} />
      </RepairFormSection>

      <RepairFormSection title="بيانات الصيانة">
        <RepairBookingServiceFields
          form={form}
          services={services}
          deliveryOptions={deliveryOptions}
          onChange={onChange}
        />
      </RepairFormSection>

      <div className={styles.feedbackStack}>
        <RepairBookingFormFeedback error={error} message={message} />
      </div>
    </>
  );
}

/**
 * Coordinates the repair booking experience while keeping the form layout direct and compact.
 *
 * @param {{ services?: Array<{ id?: string, name?: string, price?: number | string }>, deliveryMethods?: Array<{ value?: string, label?: string }> }} props
 * @returns {JSX.Element}
 */
export default function RepairBookingForm({ services = [], deliveryMethods = [] }) {
  const formState = useRepairBookingForm({ services, deliveryMethods });

  return (
    <div className={`${styles.card} repair-form-card`}>
      <RepairBookingHeader isAccountPrefilled={formState.isAccountPrefilled} />

      <form className={styles.form} onSubmit={formState.handleSubmit}>
        <RepairFormContent
          form={formState.form}
          services={services}
          deliveryOptions={formState.deliveryOptions}
          error={formState.error}
          message={formState.message}
          onChange={formState.handleFieldChange}
        />
        <RepairFormSubmitBar loading={formState.loading} disabled={services.length === 0} />
      </form>
    </div>
  );
}
