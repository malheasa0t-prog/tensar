/**
 * Renders the service-specific fields and conditional delivery inputs.
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
  return (
    <>
      <label>
        خدمة الصيانة *
        <select name="serviceId" value={form.serviceId} onChange={onChange} required>
          {services.length === 0 ? (
            <option value="">لا توجد خدمات متاحة حاليًا</option>
          ) : (
            services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} - {Number(service.price || 0).toFixed(2)} د.أ
              </option>
            ))
          )}
        </select>
      </label>

      <label>
        الوصف
        <textarea
          name="description"
          value={form.description}
          onChange={onChange}
          rows={3}
          placeholder="اشرح العطل أو طلب الصيانة"
        />
      </label>

      <label>
        طريقة الاستلام
        <select name="mode" value={form.mode} onChange={onChange}>
          {deliveryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {form.mode === "delivery" ? (
        <label>
          العنوان *
          <input name="address" value={form.address} onChange={onChange} required />
        </label>
      ) : null}
    </>
  );
}
