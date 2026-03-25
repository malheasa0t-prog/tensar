import ProfileAlert from '@/components/profile/ProfileAlert';
import { isProfileSuccessMessage } from '@/lib/profileModel';
import {
  inputStyle,
  sectionBodyStyle,
  sectionCardStyle,
  sectionHeaderStyle,
} from '@/components/profile/profileStyles';

/**
 * Password update form card.
 *
 * @param {{
 *   passwordForm: { new_password: string, confirm_password: string },
 *   passwordLoading: boolean,
 *   passwordMessage: string,
 *   onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>,
 *   onFieldChange: (event: React.ChangeEvent<HTMLInputElement>) => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function ProfilePasswordCard({
  passwordForm,
  passwordLoading,
  passwordMessage,
  onSubmit,
  onFieldChange,
}) {
  const tone = isProfileSuccessMessage(passwordMessage) ? 'success' : 'error';

  return (
    <div style={sectionCardStyle}>
      <div style={sectionHeaderStyle}>
        <h3 style={{ fontSize: '1.1rem' }}>🔐 تغيير كلمة المرور</h3>
      </div>

      <div style={sectionBodyStyle}>
        <ProfileAlert message={passwordMessage} tone={tone} />

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
              كلمة المرور الجديدة
            </label>
            <input
              type="password"
              name="new_password"
              value={passwordForm.new_password}
              onChange={onFieldChange}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>
              تأكيد كلمة المرور
            </label>
            <input
              type="password"
              name="confirm_password"
              value={passwordForm.confirm_password}
              onChange={onFieldChange}
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={passwordLoading}
            className="btn btn-outline"
            style={{ padding: '12px 22px', borderRadius: '12px', fontWeight: '700' }}
          >
            {passwordLoading ? '⏳ جاري التغيير...' : 'تحديث كلمة المرور'}
          </button>
        </form>
      </div>
    </div>
  );
}
