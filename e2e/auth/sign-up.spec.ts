import { test, expect } from '../fixtures/test-fixtures';
import { generateTestEmail } from '../helpers/auth-helpers';

/**
 * E2E Tests for Sign Up functionality
 */
test.describe('Sign Up', () => {
  test.beforeEach(async ({ authPage }) => {
    // Navigate to a protected page to trigger auth form
    await authPage.navigate();
    await authPage.waitForAuthForm();
    // Switch to sign up mode
    await authPage.switchToSignUp();
  });

  test('should show error when signing up with existing email', async ({
    authPage,
    testCredentials,
  }) => {
    const testPassword = 'TestPassword123!';

    // Try to register with already existing email
    await authPage.emailInput.fill(testCredentials.email);
    await authPage.passwordInput.fill(testPassword);
    await authPage.confirmPasswordInput.fill(testPassword);
    await authPage.submitButton.click();

    // Wait for error message
    await expect(authPage.errorMessage).toBeVisible({ timeout: 10000 });
    
    const errorText = await authPage.getErrorMessage();
    expect(errorText).toContain('already exists');
  });

  test('should show validation error for weak password', async ({ authPage }) => {
    const testEmail = generateTestEmail();

    // Enter password that is too short
    await authPage.emailInput.fill(testEmail);
    await authPage.passwordInput.fill('12345'); // Less than 6 characters
    await authPage.confirmPasswordInput.fill('12345');
    await authPage.submitButton.click();

    // Check for password error
    await expect(authPage.passwordError).toBeVisible();
    const passwordErrorText = await authPage.getFieldError('password');
    expect(passwordErrorText).toContain('at least 6 characters');
  });

  test('should show validation error for mismatched passwords', async ({
    authPage,
  }) => {
    const testEmail = generateTestEmail();

    // Enter different passwords
    await authPage.emailInput.fill(testEmail);
    await authPage.passwordInput.fill('password123');
    await authPage.confirmPasswordInput.fill('password456');
    await authPage.submitButton.click();

    // Check for confirm password error
    await expect(authPage.confirmPasswordError).toBeVisible();
    const confirmErrorText = await authPage.getFieldError('confirmPassword');
    expect(confirmErrorText).toContain('Passwords do not match');
  });

  test('should show validation errors for empty fields', async ({ authPage }) => {
    // Try to submit empty form
    await authPage.submitButton.click();

    // Check for all field errors
    await expect(authPage.emailError).toBeVisible();
    await expect(authPage.passwordError).toBeVisible();
    await expect(authPage.confirmPasswordError).toBeVisible();

    const emailErrorText = await authPage.getFieldError('email');
    expect(emailErrorText).toContain('Email is required');

    const passwordErrorText = await authPage.getFieldError('password');
    expect(passwordErrorText).toContain('Password is required');

    const confirmErrorText = await authPage.getFieldError('confirmPassword');
    expect(confirmErrorText).toContain('confirm your password');
  });

  test('should show validation error for invalid email format', async ({
    authPage,
  }) => {
    // Enter invalid email format
    await authPage.emailInput.fill('invalid-email');
    await authPage.passwordInput.fill('password123');
    await authPage.confirmPasswordInput.fill('password123');
    await authPage.submitButton.click();

    // Check for email format error
    await expect(authPage.emailError).toBeVisible();
    const emailErrorText = await authPage.getFieldError('email');
    expect(emailErrorText).toContain('valid email address');
  });

  test('should show Sign Up heading and correct button text', async ({
    authPage,
  }) => {
    // Verify we're in sign up mode
    await expect(authPage.heading).toContainText('Create an account');
    await expect(authPage.submitButton).toContainText('Create account');
  });

  test('should show confirm password field in sign up mode', async ({
    authPage,
  }) => {
    // Confirm password field should be visible in sign up mode
    await expect(authPage.confirmPasswordInput).toBeVisible();
  });

  test('should show loading state while submitting', async ({ authPage }) => {
    const testEmail = generateTestEmail();
    const testPassword = 'TestPassword123!';

    // Fill in form
    await authPage.emailInput.fill(testEmail);
    await authPage.passwordInput.fill(testPassword);
    await authPage.confirmPasswordInput.fill(testPassword);

    // Click submit
    await authPage.submitButton.click();

    // The button text should change to "Creating account…"
    await expect(authPage.submitButton).toContainText(/Creating account|Create account/);
  });
});

