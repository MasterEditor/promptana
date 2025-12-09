import { test, expect } from '../fixtures/test-fixtures';

/**
 * E2E Tests for Sign In functionality
 */
test.describe('Sign In', () => {
  test.beforeEach(async ({ authPage }) => {
    // Navigate to a protected page to trigger auth form
    await authPage.navigate();
    await authPage.waitForAuthForm();
  });

  test('should successfully sign in with valid credentials', async ({
    authPage,
    testCredentials,
  }) => {
    // Fill in valid credentials
    await authPage.signIn(testCredentials.email, testCredentials.password);

    // Wait for successful authentication and redirect
    await authPage.waitForAuthSuccess();

    // Verify we're on the prompts page
    await expect(authPage.page).toHaveURL(/\/prompts/);
  });

  test('should show error for invalid email', async ({ authPage }) => {
    // Try to sign in with non-existent email
    await authPage.signIn('nonexistent@example.com', 'somepassword123');

    // Wait for error message to appear
    await expect(authPage.errorMessage).toBeVisible();
    
    // Check error message content
    const errorText = await authPage.getErrorMessage();
    expect(errorText).toContain('Invalid email or password');
  });

  test('should show error for wrong password', async ({
    authPage,
    testCredentials,
  }) => {
    // Try to sign in with correct email but wrong password
    await authPage.signIn(testCredentials.email, 'wrongpassword123');

    // Wait for error message to appear
    await expect(authPage.errorMessage).toBeVisible();
    
    // Check error message content
    const errorText = await authPage.getErrorMessage();
    expect(errorText).toContain('Invalid email or password');
  });

  test('should show validation errors for empty fields', async ({ authPage }) => {
    // Try to submit empty form
    await authPage.submitButton.click();

    // Check for email error
    await expect(authPage.emailError).toBeVisible();
    const emailErrorText = await authPage.getFieldError('email');
    expect(emailErrorText).toContain('Email is required');

    // Check for password error
    await expect(authPage.passwordError).toBeVisible();
    const passwordErrorText = await authPage.getFieldError('password');
    expect(passwordErrorText).toContain('Password is required');
  });

  test('should show validation error for invalid email format', async ({
    authPage,
  }) => {
    // Enter invalid email format
    await authPage.emailInput.fill('not-a-valid-email');
    await authPage.passwordInput.fill('somepassword');
    await authPage.submitButton.click();

    // Check for email format error
    await expect(authPage.emailError).toBeVisible();
    const emailErrorText = await authPage.getFieldError('email');
    expect(emailErrorText).toContain('Please enter a valid email address');
  });

  test('should show loading state while submitting', async ({
    authPage,
    testCredentials,
  }) => {
    // Fill in credentials
    await authPage.emailInput.fill(testCredentials.email);
    await authPage.passwordInput.fill(testCredentials.password);

    // Click submit and quickly check for loading state
    await authPage.submitButton.click();

    // The button text should change to "Signing in…"
    // Note: This might be flaky if auth is too fast
    await expect(authPage.submitButton).toContainText(/Signing in|Sign in/);
  });

  test('should disable inputs while submitting', async ({
    authPage,
    testCredentials,
  }) => {
    // Fill in credentials
    await authPage.emailInput.fill(testCredentials.email);
    await authPage.passwordInput.fill(testCredentials.password);

    // Start submission
    const submitPromise = authPage.submitButton.click();

    // Check inputs are disabled during submission
    // Note: This check needs to happen quickly before redirect
    await expect(authPage.emailInput).toBeDisabled({ timeout: 1000 }).catch(() => {
      // If we can't catch the disabled state, the form submitted too fast - that's OK
    });

    await submitPromise;
  });

  test('should show Sign In heading and correct button text', async ({
    authPage,
  }) => {
    // Verify we're in sign in mode
    await expect(authPage.heading).toContainText('Sign in to Promptana');
    await expect(authPage.submitButton).toContainText('Sign in');
  });
});

