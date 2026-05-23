import ProfileAlert from '@/components/profile/ProfileAlert';
import {
  cardTitleStyle,
  disabledInputStyle,
  fieldGridStyle,
  fieldGroupStyle,
  fieldLabelStyle,
  formStyle,
  inputStyle,
  mutedFieldLabelStyle,
  primaryActionStyle,
  sectionBodyStyle,
  sectionCardStyle,
  sectionHeaderStyle,
} from '@/components/profile/profileStyles';

/**
 * Profile details form card.
 *
 * @param {{
 *   email: string,
 *   form: Record<string, string>,
 *   saving: boolean,
 *   success: string,
 *   error: string,
 *   onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>,
 *   onFieldChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function ProfileInfoCard({
  email,
  form,
  saving,
  success,
  error,
  onSubmit,
  onFieldChange,
}) {
  return (
    <div style={sectionCardStyle}>
      <div style={sectionHeaderStyle}>
        <h3 style={cardTitleStyle}>👤 الملف الشخصي</h3>
      </div>

      <div style={sectionBodyStyle}>
        <ProfileAlert message={success} tone="success" />
        <ProfileAlert message={error} tone="error" />

        <div style={fieldGroupStyle}>
          <label style={mutedFieldLabelStyle}>البريد الإلكتروني</label>
          <input
            type="email"
            value={email}
            disabled
            style={{
              ...disabledInputStyle,
              direction: 'ltr',
              textAlign: 'left',
            }}
          />
        </div>

        <div style={fieldGroupStyle}>
          <label style={mutedFieldLabelStyle}>الاسم الكامل</label>
          <input
            type="text"
            value={form.full_name}
            disabled
            style={disabledInputStyle}
          />
        </div>

        <div style={fieldGroupStyle}>
          <label style={mutedFieldLabelStyle}>رقم الهاتف</label>
          <input
            type="tel"
            value={form.phone}
            disabled
            style={{ ...disabledInputStyle, direction: 'ltr', textAlign: 'left' }}
          />
        </div>

        <div style={fieldGridStyle}>
          <div style={fieldGroupStyle}>
            <label style={mutedFieldLabelStyle}>الدولة</label>
            <input
              type="text"
              value={form.country}
              disabled
              style={disabledInputStyle}
            />
          </div>

          <div style={fieldGroupStyle}>
            <label style={mutedFieldLabelStyle}>العملة المفضلة</label>
            <input
              type="text"
              value={form.preferred_currency}
              disabled
              style={disabledInputStyle}
            />
          </div>
        </div>

        <form onSubmit={onSubmit} style={formStyle}>
          <div style={fieldGroupStyle}>
            <label style={fieldLabelStyle}>اللغة المفضلة</label>
            <select
              name="preferred_language"
              value={form.preferred_language}
              onChange={onFieldChange}
              style={inputStyle}
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{
              ...primaryActionStyle,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '⏳ جاري الحفظ...' : '💾 حفظ التغييرات'}
          </button>
        </form>
      </div>
    </div>
  );
}
