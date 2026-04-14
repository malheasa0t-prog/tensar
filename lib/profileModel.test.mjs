import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProfileFormState,
  isProfileSuccessMessage,
  PASSWORD_FORM_DEFAULTS,
  PROFILE_FORM_DEFAULTS,
} from './profileModel.js';

test('createProfileFormState should omit avatar url from editable profile state', () => {
  const form = createProfileFormState({
    full_name: 'Ali',
    phone: '0799999999',
    avatar_url: 'https://example.com/avatar.png',
    country: 'Jordan',
    bio: 'Bio',
    preferred_language: 'en',
    preferred_currency: 'USD',
  });

  assert.deepEqual(form, {
    full_name: 'Ali',
    phone: '0799999999',
    country: 'Jordan',
    preferred_language: 'en',
    preferred_currency: 'USD',
  });
  assert.equal(Object.hasOwn(form, 'avatar_url'), false);
  assert.equal(Object.hasOwn(form, 'bio'), false);
});

test('createProfileFormState should return defaults for missing profile values', () => {
  assert.deepEqual(createProfileFormState(null), PROFILE_FORM_DEFAULTS);
});

test('isProfileSuccessMessage should detect success messages only', () => {
  assert.equal(isProfileSuccessMessage('تم الحفظ بنجاح'), true);
  assert.equal(isProfileSuccessMessage('فشل الحفظ'), false);
});

test('PASSWORD_FORM_DEFAULTS should include the current password field', () => {
  assert.deepEqual(PASSWORD_FORM_DEFAULTS, {
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
});
