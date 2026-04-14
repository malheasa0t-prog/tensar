/**
 * Shared presentation tokens for the customer profile forms.
 */

const PROFILE_CARD_BACKGROUND =
  'linear-gradient(180deg, rgba(16, 22, 52, 0.96), rgba(8, 13, 33, 0.98))';
const PROFILE_CARD_BORDER = '1px solid rgba(255, 255, 255, 0.1)';
const PROFILE_CARD_SHADOW = '0 24px 48px rgba(3, 6, 18, 0.32)';
const PROFILE_INPUT_BACKGROUND =
  'linear-gradient(180deg, rgba(20, 28, 61, 0.98), rgba(11, 17, 40, 1))';
const PROFILE_INPUT_BORDER = '1px solid rgba(167, 185, 255, 0.14)';
const PROFILE_TEXT_PRIMARY = '#eef3ff';
const PROFILE_TEXT_MUTED = '#b6c2de';

export const sectionCardStyle = {
  background: PROFILE_CARD_BACKGROUND,
  border: PROFILE_CARD_BORDER,
  borderRadius: '24px',
  overflow: 'hidden',
  boxShadow: PROFILE_CARD_SHADOW,
};

export const sectionHeaderStyle = {
  padding: '20px 24px',
  borderBottom: PROFILE_CARD_BORDER,
  background:
    'linear-gradient(180deg, rgba(131, 56, 236, 0.14), rgba(0, 217, 255, 0.05))',
};

export const sectionBodyStyle = {
  display: 'grid',
  gap: '18px',
  padding: '24px',
  background: 'rgba(7, 11, 28, 0.34)',
};

export const cardTitleStyle = {
  margin: 0,
  fontSize: '1.1rem',
  color: PROFILE_TEXT_PRIMARY,
};

export const fieldGroupStyle = {
  display: 'grid',
  gap: '8px',
};

export const fieldGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '12px',
};

export const fieldLabelStyle = {
  display: 'block',
  fontWeight: '700',
  fontSize: '0.9rem',
  color: PROFILE_TEXT_PRIMARY,
};

export const mutedFieldLabelStyle = {
  ...fieldLabelStyle,
  color: PROFILE_TEXT_MUTED,
  fontSize: '0.85rem',
};

export const inputStyle = {
  width: '100%',
  minHeight: '52px',
  padding: '14px 16px',
  borderRadius: '14px',
  border: PROFILE_INPUT_BORDER,
  background: PROFILE_INPUT_BACKGROUND,
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  color: PROFILE_TEXT_PRIMARY,
  fontSize: '1rem',
  outline: 'none',
};

export const disabledInputStyle = {
  ...inputStyle,
  color: PROFILE_TEXT_MUTED,
  cursor: 'not-allowed',
  opacity: 0.88,
};

export const formStyle = {
  display: 'grid',
  gap: '18px',
};

export const primaryActionStyle = {
  padding: '14px 32px',
  borderRadius: '14px',
  fontWeight: '800',
  fontSize: '1rem',
};

export const secondaryActionStyle = {
  padding: '12px 22px',
  borderRadius: '14px',
  fontWeight: '800',
};
