import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSING_CURRENT_PASSWORD_MESSAGE,
  PASSWORD_MISMATCH_MESSAGE,
  PASSWORD_REQUIREMENTS_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
  validatePasswordChangeForm,
} from './profilePasswordModel.js';

test('validatePasswordChangeForm should require the current password', () => {
  assert.equal(
    validatePasswordChangeForm({
      current_password: '',
      new_password: 'Password123',
      confirm_password: 'Password123',
    }),
    MISSING_CURRENT_PASSWORD_MESSAGE
  );
});

test('validatePasswordChangeForm should reject short passwords', () => {
  assert.equal(
    validatePasswordChangeForm({
      current_password: 'OldPass123',
      new_password: 'Abc123',
      confirm_password: 'Abc123',
    }),
    PASSWORD_TOO_SHORT_MESSAGE
  );
});

test('validatePasswordChangeForm should reject passwords without letters and numbers', () => {
  assert.equal(
    validatePasswordChangeForm({
      current_password: 'OldPass123',
      new_password: 'abcdefgh',
      confirm_password: 'abcdefgh',
    }),
    PASSWORD_REQUIREMENTS_MESSAGE
  );
});

test('validatePasswordChangeForm should reject password mismatch', () => {
  assert.equal(
    validatePasswordChangeForm({
      current_password: 'OldPass123',
      new_password: 'Password123',
      confirm_password: 'Password124',
    }),
    PASSWORD_MISMATCH_MESSAGE
  );
});

test('validatePasswordChangeForm should accept a valid payload', () => {
  assert.equal(
    validatePasswordChangeForm({
      current_password: 'OldPass123',
      new_password: 'Password123',
      confirm_password: 'Password123',
    }),
    null
  );
});
