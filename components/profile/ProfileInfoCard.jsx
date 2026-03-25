import ProfileAlert from '@/components/profile/ProfileAlert';
import {
  inputStyle,
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
        <h3 style={{ fontSize: '1.1rem' }}>👤 الملف الشخصي</h3>
      </div>

      <div style={sectionBodyStyle}>
        <ProfileAlert message={success} tone="success" />
        <ProfileAlert message={error} tone="error" />

        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}
          >
            البريد الإلكتروني
          </label>
          <input
            type="email"
            value={email}
            disabled
            style={{
              ...inputStyle,
              color: 'var(--text-muted)',
              direction: 'ltr',
              textAlign: 'left',
              cursor: 'not-allowed',
              opacity: 0.7,
            }}
          />
        </div>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
              الاسم الكامل
            </label>
            <input
              type="text"
              name="full_name"
              value={form.full_name}
              onChange={onFieldChange}
              placeholder="أدخل اسمك الكامل"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
              رقم الهاتف
            </label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={onFieldChange}
              placeholder="07XXXXXXXX"
              style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }}
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
              رابط الصورة الشخصية
            </label>
            <input
              type="url"
              name="avatar_url"
              value={form.avatar_url}
              onChange={onFieldChange}
              placeholder="https://..."
              style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '18px',
            }}
          >
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                الدولة
              </label>
              <input
                type="text"
                name="country"
                value={form.country}
                onChange={onFieldChange}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                العملة المفضلة
              </label>
              <select
                name="preferred_currency"
                value={form.preferred_currency}
                onChange={onFieldChange}
                style={inputStyle}
              >
                <option value="JOD">JOD</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
              اللغة المفضلة
            </label>
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

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
              نبذة قصيرة
            </label>
            <textarea
              name="bio"
              value={form.bio}
              onChange={onFieldChange}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{
              padding: '14px 32px',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '1rem',
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
