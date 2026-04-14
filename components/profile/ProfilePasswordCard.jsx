import ProfileAlert from '@/components/profile/ProfileAlert';
import { isProfileSuccessMessage } from '@/lib/profileModel';
import {
  cardTitleStyle,
  fieldGroupStyle,
  fieldLabelStyle,
  formStyle,
  inputStyle,
  secondaryActionStyle,
  sectionBodyStyle,
  sectionCardStyle,
  sectionHeaderStyle,
} from '@/components/profile/profileStyles';

/**
 * Password update form card.
 *
 * @param {{
 *   passwordForm: { current_password: string, new_password: string, confirm_password: string },
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
        <h3 style={cardTitleStyle}>تغيير كلمة المرور</h3>
      </div>

      <div style={sectionBodyStyle}>
        <ProfileAlert message={passwordMessage} tone={tone} />

        <form onSubmit={onSubmit} style={formStyle}>
          <div style={fieldGroupStyle}>
            <label style={fieldLabelStyle}>كلمة المرور الحالية</label>
            <input
              type="password"
              name="current_password"
              value={passwordForm.current_password}
              onChange={onFieldChange}
              autoComplete="current-password"
              style={inputStyle}
            />
          </div>

          <div style={fieldGroupStyle}>
            <label style={fieldLabelStyle}>كلمة المرور الجديدة</label>
            <input
              type="password"
              name="new_password"
              value={passwordForm.new_password}
              onChange={onFieldChange}
              autoComplete="new-password"
              style={inputStyle}
            />
          </div>

          <div style={fieldGroupStyle}>
            <label style={fieldLabelStyle}>تأكيد كلمة المرور الجديدة</label>
            <input
              type="password"
              name="confirm_password"
              value={passwordForm.confirm_password}
              onChange={onFieldChange}
              autoComplete="new-password"
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={passwordLoading}
            className="btn btn-outline"
            style={secondaryActionStyle}
          >
            {passwordLoading ? 'جاري التغيير...' : 'تحديث كلمة المرور'}
          </button>
        </form>
      </div>
    </div>
  );
}
