'use client';

import { useEffect, useState } from 'react';
import {
  createProfileFormState,
  PASSWORD_FORM_DEFAULTS,
  PROFILE_FORM_DEFAULTS,
} from '@/lib/profileModel';
import {
  fetchProfileSnapshot,
  saveProfilePassword,
  saveProfileSnapshot,
} from '@/services/profileService';

const PROFILE_LOAD_ERROR_MESSAGE = '[ACP-301] تعذر تحميل الملف الشخصي';
const PROFILE_SAVE_ERROR_MESSAGE = '[ACP-302] تعذر حفظ البيانات';
const PROFILE_PASSWORD_ERROR_MESSAGE = '[ACP-303] تعذر تغيير كلمة المرور';

/**
 * Handles profile loading, editing, and password updates.
 *
 * @returns {{
 *   email: string,
 *   form: Record<string, string>,
 *   loading: boolean,
 *   saving: boolean,
 *   success: string,
 *   error: string,
 *   passwordForm: { current_password: string, new_password: string, confirm_password: string },
 *   passwordLoading: boolean,
 *   passwordMessage: string,
 *   updateFormField: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void,
 *   updatePasswordField: (event: React.ChangeEvent<HTMLInputElement>) => void,
 *   handleSave: (event: React.FormEvent<HTMLFormElement>) => Promise<void>,
 *   handlePasswordSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>,
 * }}
 */
export function useProfilePage() {
  const [email, setEmail] = useState('');
  const [form, setForm] = useState(PROFILE_FORM_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [passwordForm, setPasswordForm] = useState(PASSWORD_FORM_DEFAULTS);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');

  useEffect(() => {
    let active = true;

    /**
     * Loads the profile snapshot once when the page mounts.
     *
     * @returns {Promise<void>}
     */
    async function loadProfile() {
      try {
        const snapshot = await fetchProfileSnapshot();

        if (!active) {
          return;
        }

        setEmail(snapshot.email);
        setForm(createProfileFormState(snapshot.profile));
      } catch (err) {
        if (!active) {
          return;
        }

        const nextError = err instanceof Error ? err.message : PROFILE_LOAD_ERROR_MESSAGE;
        setError(nextError);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!success) {
      return undefined;
    }

    const timerId = window.setTimeout(() => setSuccess(''), 3000);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [success]);

  /**
   * Updates one profile form field.
   *
   * @param {React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>} event
   * @returns {void}
   */
  function updateFormField(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  /**
   * Updates one password form field.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   * @returns {void}
   */
  function updatePasswordField(event) {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  }

  /**
   * Saves the profile form through the API layer.
   *
   * @param {React.FormEvent<HTMLFormElement>} event
   * @returns {Promise<void>}
   */
  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const message = await saveProfileSnapshot(form);
      setSuccess(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : PROFILE_SAVE_ERROR_MESSAGE);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Saves a new password through the API layer.
   *
   * @param {React.FormEvent<HTMLFormElement>} event
   * @returns {Promise<void>}
   */
  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordLoading(true);
    setPasswordMessage('');

    try {
      const message = await saveProfilePassword(passwordForm);
      setPasswordForm(PASSWORD_FORM_DEFAULTS);
      setPasswordMessage(message);
    } catch (err) {
      setPasswordMessage(err instanceof Error ? err.message : PROFILE_PASSWORD_ERROR_MESSAGE);
    } finally {
      setPasswordLoading(false);
    }
  }

  return {
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
  };
}
