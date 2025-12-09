import { test, expect } from '../fixtures/test-fixtures';

/**
 * E2E Tests for Auth UI/UX behavior
 */
test.describe('Auth Form UI/UX', () => {
  test.beforeEach(async ({ authPage }) => {
    // Navigate to a protected page to trigger auth form
    await authPage.navigate();
    await authPage.waitForAuthForm();
  });

  test.describe('Mode Switching', () => {
    test('should switch from Sign In to Sign Up mode', async ({ authPage }) => {
      // Initially in Sign In mode
      await expect(authPage.heading).toContainText('Sign in to Promptana');
      await expect(authPage.submitButton).toContainText('Sign in');
      await expect(authPage.confirmPasswordInput).not.toBeVisible();

      // Click Sign Up link
      await authPage.switchToSignUp();

      // Should be in Sign Up mode now
      await expect(authPage.heading).toContainText('Create an account');
      await expect(authPage.submitButton).toContainText('Create account');
      await expect(authPage.confirmPasswordInput).toBeVisible();
    });

    test('should switch from Sign Up to Sign In mode', async ({ authPage }) => {
      // Switch to Sign Up first
      await authPage.switchToSignUp();
      await expect(authPage.heading).toContainText('Create an account');

      // Click Sign In link
      await authPage.switchToSignIn();

      // Should be back in Sign In mode
      await expect(authPage.heading).toContainText('Sign in to Promptana');
      await expect(authPage.submitButton).toContainText('Sign in');
      await expect(authPage.confirmPasswordInput).not.toBeVisible();
    });

    test('should clear validation errors when switching modes', async ({
      authPage,
    }) => {
      // Submit empty form to trigger validation errors
      await authPage.submitButton.click();

      // Verify errors are visible
      await expect(authPage.emailError).toBeVisible();
      await expect(authPage.passwordError).toBeVisible();

      // Switch to Sign Up mode
      await authPage.switchToSignUp();

      // Errors should be cleared
      await expect(authPage.emailError).not.toBeVisible();
      await expect(authPage.passwordError).not.toBeVisible();
    });

    test('should clear password fields when switching modes', async ({
      authPage,
    }) => {
      // Fill in password in Sign In mode
      await authPage.passwordInput.fill('somepassword');
      expect(await authPage.passwordInput.inputValue()).toBe('somepassword');

      // Switch to Sign Up mode
      await authPage.switchToSignUp();

      // Password should be cleared
      expect(await authPage.passwordInput.inputValue()).toBe('');
    });

    test('should preserve email when switching modes', async ({ authPage }) => {
      const testEmail = 'test@example.com';

      // Fill in email in Sign In mode
      await authPage.emailInput.fill(testEmail);

      // Switch to Sign Up mode
      await authPage.switchToSignUp();

      // Email should be preserved
      expect(await authPage.emailInput.inputValue()).toBe(testEmail);
    });
  });

  test.describe('Field Validation Behavior', () => {
    test('should clear email error when user starts typing', async ({
      authPage,
    }) => {
      // Submit empty form to trigger validation error
      await authPage.submitButton.click();
      await expect(authPage.emailError).toBeVisible();

      // Start typing in email field
      await authPage.emailInput.fill('t');

      // Error should be cleared
      await expect(authPage.emailError).not.toBeVisible();
    });

    test('should clear password error when user starts typing', async ({
      authPage,
    }) => {
      // Submit empty form to trigger validation error
      await authPage.submitButton.click();
      await expect(authPage.passwordError).toBeVisible();

      // Start typing in password field
      await authPage.passwordInput.fill('p');

      // Error should be cleared
      await expect(authPage.passwordError).not.toBeVisible();
    });

    test('should clear confirm password error when user starts typing', async ({
      authPage,
    }) => {
      // Switch to Sign Up mode
      await authPage.switchToSignUp();

      // Submit empty form to trigger validation error
      await authPage.submitButton.click();
      await expect(authPage.confirmPasswordError).toBeVisible();

      // Start typing in confirm password field
      await authPage.confirmPasswordInput.fill('p');

      // Error should be cleared
      await expect(authPage.confirmPasswordError).not.toBeVisible();
    });
  });

  test.describe('Form Accessibility', () => {
    test('should have proper ARIA attributes for invalid fields', async ({
      authPage,
    }) => {
      // Submit empty form to trigger validation
      await authPage.submitButton.click();

      // Email field should have aria-invalid="true"
      await expect(authPage.emailInput).toHaveAttribute('aria-invalid', 'true');
      
      // Password field should have aria-invalid="true"
      await expect(authPage.passwordInput).toHaveAttribute('aria-invalid', 'true');
    });

    test('should have status container with role="status"', async ({
      authPage,
    }) => {
      await expect(authPage.statusContainer).toHaveAttribute('role', 'status');
      await expect(authPage.statusContainer).toHaveAttribute('aria-live', 'polite');
    });

    test('should have associated error messages via aria-describedby', async ({
      authPage,
    }) => {
      // Submit empty form to trigger validation
      await authPage.submitButton.click();

      // Email field should reference email-error
      await expect(authPage.emailInput).toHaveAttribute(
        'aria-describedby',
        'email-error'
      );

      // Password field should reference password-error
      await expect(authPage.passwordInput).toHaveAttribute(
        'aria-describedby',
        'password-error'
      );
    });
  });

  test.describe('Form Labels', () => {
    test('should have proper labels for all form fields', async ({
      authPage,
    }) => {
      // Email label
      const emailLabel = authPage.page.locator('label[for="email"]');
      await expect(emailLabel).toContainText('Email');

      // Password label
      const passwordLabel = authPage.page.locator('label[for="password"]');
      await expect(passwordLabel).toContainText('Password');

      // Switch to Sign Up to check confirm password label
      await authPage.switchToSignUp();

      const confirmPasswordLabel = authPage.page.locator(
        'label[for="confirm-password"]'
      );
      await expect(confirmPasswordLabel).toContainText('Confirm Password');
    });
  });

  test.describe('Description Text', () => {
    test('should show correct description in Sign In mode', async ({
      authPage,
    }) => {
      const description = authPage.page.locator('p.text-sm.text-zinc-600, p.text-sm.dark\\:text-zinc-400').first();
      await expect(description).toContainText('sign in to continue');
    });

    test('should show correct description in Sign Up mode', async ({
      authPage,
    }) => {
      await authPage.switchToSignUp();
      
      const description = authPage.page.locator('p.text-sm.text-zinc-600, p.text-sm.dark\\:text-zinc-400').first();
      await expect(description).toContainText('Create your account');
    });
  });
});

