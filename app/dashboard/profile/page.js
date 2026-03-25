'use client';

import ProfileInfoCard from '@/components/profile/ProfileInfoCard';
import ProfilePasswordCard from '@/components/profile/ProfilePasswordCard';
import { useProfilePage } from '@/hooks/useProfilePage';

/**
 * Customer profile page with separate cards for personal data and password updates.
 *
 * @returns {JSX.Element}
 */
export default function ProfilePage() {
  const {
    email,
    form,
    loading,
    saving,
    success,
    error,
    passwordForm,
    passwordLoading,
    passwordMessage,
    updateFormField,
    updatePasswordField,
    handleSave,
    handlePasswordSubmit,
  } = useProfilePage();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        جاري التحميل...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '760px', display: 'grid', gap: '18px' }}>
      <ProfileInfoCard
        email={email}
        form={form}
        saving={saving}
        success={success}
        error={error}
        onSubmit={handleSave}
        onFieldChange={updateFormField}
      />

      <ProfilePasswordCard
        passwordForm={passwordForm}
        passwordLoading={passwordLoading}
        passwordMessage={passwordMessage}
        onSubmit={handlePasswordSubmit}
        onFieldChange={updatePasswordField}
      />
    </div>
  );
}
