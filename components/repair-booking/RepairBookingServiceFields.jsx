import { getRepairModeHelper } from "@/lib/repairBookingModel.mjs";
import { formatCurrency } from "@/lib/formatCurrency";
import styles from "./RepairBookingForm.module.css";

/**
 * Formats the service starting price for display.
 *
 * @param {number | string | undefined} price
 * @returns {string}
 */
function formatServicePrice(price) {
  return formatCurrency(price);
}

/**
 * Renders the service selector and its price summary.
 *
 * @param {{
 *   serviceId: string,
 *   services: Array<{ id?: string, name?: string, price?: number | string }>,
 *   selectedService?: { price?: number | string },
 *   onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void
 * }} props
 * @returns {JSX.Element}
 */
function ServiceSelectField({ serviceId, services, selectedService, onChange }) {
  return (
    <label className={`${styles.field} ${styles.fieldWide}`}>
      <span className={styles.fieldLabel}>الخدمة المطلوبة *</span>
      <select
        className={`form-input ${styles.input} ${styles.selectInput}`}
        name="serviceId"
        value={serviceId}
        onChange={onChange}
        required
        disabled={services.length === 0}
      >
        {services.length === 0 ? (
          <option value="">لا توجد خدمات متاحة حاليًا</option>
        ) : (
          services.map((service) => (
            <option key={service.id} value={service.id || ""}>
              {service.name || "خدمة صيانة"} - {formatServicePrice(service.price)}
            </option>
          ))
        )}
      </select>

      {selectedService ? (
        <div className={styles.fieldMeta}>
          <span className={styles.metaLabel}>السعر المبدئي</span>
          <span className={styles.metaValue}>{formatServicePrice(selectedService.price)}</span>
        </div>
      ) : (
        <span className={styles.fieldHint}>لا يمكن إرسال الطلب قبل إضافة خدمة صيانة واحدة على الأقل.</span>
      )}
    </label>
  );
}

/**
 * Renders the issue description textarea.
 *
 * @param {{
 *   description: string,
 *   onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void
 * }} props
 * @returns {JSX.Element}
 */
function DescriptionField({ description, onChange }) {
  return (
    <label className={`${styles.field} ${styles.fieldWide}`}>
      <span className={styles.fieldLabel}>وصف المشكلة</span>
      <textarea
        className={`form-input ${styles.input} ${styles.textareaInput}`}
        name="description"
        value={description}
        onChange={onChange}
        rows={5}
        placeholder="اشرح المشكلة أو المطلوب عمله في الجهاز."
      />
    </label>
  );
}

/**
 * Renders the execution mode selector and its helper text.
 *
 * @param {{
 *   mode: string,
 *   deliveryOptions: Array<{ value?: string, label?: string }>,
 *   onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void
 * }} props
 * @returns {JSX.Element}
 */
function ModeSelectField({ mode, deliveryOptions, onChange }) {
  return (
    <label className={`${styles.field} ${styles.fieldWide}`}>
      <span className={styles.fieldLabel}>طريقة الاستلام أو التنفيذ *</span>
      <select
        className={`form-input ${styles.input} ${styles.selectInput}`}
        name="mode"
        value={mode}
        onChange={onChange}
        required
      >
        {deliveryOptions.map((option) => (
          <option key={option.value} value={option.value || ""}>
            {option.label}
          </option>
        ))}
      </select>
      <span className={styles.fieldHint}>{getRepairModeHelper(mode)}</span>
    </label>
  );
}

/**
 * Renders the delivery address field when the selected mode requires it.
 *
 * @param {{
 *   address: string,
 *   onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
 * }} props
 * @returns {JSX.Element}
 */
function AddressField({ address, onChange }) {
  return (
    <label className={`${styles.field} ${styles.fieldWide}`}>
      <span className={styles.fieldLabel}>عنوان الاستلام *</span>
      <input
        className={`form-input ${styles.input}`}
        name="address"
        value={address}
        onChange={onChange}
        required
        placeholder="المدينة، الحي، أقرب نقطة دالة"
      />
    </label>
  );
}

/**
 * Renders the service, issue details, and execution mode fields in a direct form layout.
 *
 * @param {{
 *   form: { serviceId: string, description: string, mode: string, address: string },
 *   services: Array<{ id?: string, name?: string, price?: number | string }>,
 *   deliveryOptions: Array<{ value?: string, label?: string }>,
 *   onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
 * }} props
 * @returns {JSX.Element}
 */
export default function RepairBookingServiceFields({
  form,
  services,
  deliveryOptions,
  onChange,
}) {
  const selectedService = services.find((service) => service.id === form.serviceId);

  return (
    <div className={styles.fieldsGrid}>
      <ServiceSelectField
        serviceId={form.serviceId}
        services={services}
        selectedService={selectedService}
        onChange={onChange}
      />
      <DescriptionField description={form.description} onChange={onChange} />
      <ModeSelectField mode={form.mode} deliveryOptions={deliveryOptions} onChange={onChange} />
      {form.mode === "delivery" ? <AddressField address={form.address} onChange={onChange} /> : null}
    </div>
  );
}
