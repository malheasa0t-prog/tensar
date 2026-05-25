import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COUNTRY_INVALID_MESSAGE,
  FULL_NAME_INVALID_MESSAGE,
  FULL_NAME_REQUIRED_MESSAGE,
  PASSWORD_MISMATCH_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
  PHONE_INVALID_MESSAGE,
  PHONE_REQUIRED_MESSAGE,
  REGISTER_SUBMISSION_ACCEPTED_MESSAGE,
  isRegisterAccountEnumerationError,
  mapRegisterAuthError,
  normalizeRegisterPhone,
  normalizeRegisterProfileData,
  validateRegisterForm,
} from './registerModel.js';

test('normalizeRegisterPhone should compact separators and preserve international prefix', () => {
  assert.equal(normalizeRegisterPhone(' +962 (79) 123-4567 '), '+962791234567');
  assert.equal(normalizeRegisterPhone('00962791234567'), '+962791234567');
});

test('normalizeRegisterProfileData should trim and normalize registration metadata', () => {
  assert.deepEqual(
    normalizeRegisterProfileData({
      fullName: '  أحمد علي  ',
      phone: ' 07 9999 9999 ',
      country: '  الأردن ',
    }),
    {
      full_name: 'أحمد علي',
      phone: '0799999999',
      country: 'الأردن',
    }
  );
});

test('validateRegisterForm should require the full name', () => {
  assert.equal(
    validateRegisterForm({
      fullName: '',
      phone: '0799999999',
      country: 'الأردن',
      password: 'Secret1Password!',
      confirmPassword: 'Secret1Password!',
    }),
    FULL_NAME_REQUIRED_MESSAGE
  );
});

test('validateRegisterForm should reject very short names', () => {
  assert.equal(
    validateRegisterForm({
      fullName: 'أ',
      phone: '0799999999',
      country: 'الأردن',
      password: 'Secret1Password!',
      confirmPassword: 'Secret1Password!',
    }),
    FULL_NAME_INVALID_MESSAGE
  );
});

test('validateRegisterForm should require the phone number', () => {
  assert.equal(
    validateRegisterForm({
      fullName: 'أحمد علي',
      phone: '',
      country: 'الأردن',
      password: 'Secret1Password!',
      confirmPassword: 'Secret1Password!',
    }),
    PHONE_REQUIRED_MESSAGE
  );
});

test('validateRegisterForm should reject invalid phone numbers', () => {
  assert.equal(
    validateRegisterForm({
      fullName: 'أحمد علي',
      phone: 'abc',
      country: 'الأردن',
      password: 'Secret1Password!',
      confirmPassword: 'Secret1Password!',
    }),
    PHONE_INVALID_MESSAGE
  );
});

test('validateRegisterForm should reject invalid country values when provided', () => {
  assert.equal(
    validateRegisterForm({
      fullName: 'أحمد علي',
      phone: '0799999999',
      country: '1',
      password: 'Secret1Password!',
      confirmPassword: 'Secret1Password!',
    }),
    COUNTRY_INVALID_MESSAGE
  );
});

test('validateRegisterForm should reject mismatched passwords', () => {
  assert.equal(
    validateRegisterForm({
      fullName: 'أحمد علي',
      phone: '0799999999',
      country: 'الأردن',
      password: 'Secret1Password!',
      confirmPassword: 'AnotherPassword2!',
    }),
    PASSWORD_MISMATCH_MESSAGE
  );
});

test('validateRegisterForm should reject short passwords', () => {
  assert.equal(
    validateRegisterForm({
      fullName: 'أحمد علي',
      phone: '0799999999',
      country: 'الأردن',
      password: '12345',
      confirmPassword: '12345',
    }),
    PASSWORD_TOO_SHORT_MESSAGE
  );
});

test('validateRegisterForm should accept a valid registration payload', () => {
  assert.equal(
    validateRegisterForm({
      fullName: 'أحمد علي',
      phone: '+962791234567',
      country: 'Jordan',
      password: 'Secret1Password!',
      confirmPassword: 'Secret1Password!',
    }),
    null
  );
});

test('isRegisterAccountEnumerationError should detect duplicate account errors', () => {
  assert.equal(isRegisterAccountEnumerationError({ message: 'User already registered' }), true);
  assert.equal(isRegisterAccountEnumerationError({ message: 'Email address is already in use' }), true);
  assert.equal(isRegisterAccountEnumerationError({ message: 'Invalid email' }), false);
});

test('mapRegisterAuthError should not reveal already registered users', () => {
  assert.equal(mapRegisterAuthError({ message: 'User already registered' }), REGISTER_SUBMISSION_ACCEPTED_MESSAGE);
});

test('mapRegisterAuthError should map fetch errors', () => {
  assert.match(mapRegisterAuthError({ message: 'Failed to fetch' }), /تعذر الاتصال بخدمة المصادقة/);
});

test('mapRegisterAuthError should map invalid emails and rate limits', () => {
  assert.equal(mapRegisterAuthError({ message: 'Invalid email' }), 'أدخل بريدًا إلكترونيًا صحيحًا');
  assert.match(mapRegisterAuthError({ message: 'Too many requests' }), /تم تجاوز عدد المحاولات/);
});
