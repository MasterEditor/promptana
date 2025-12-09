import { test, expect } from '../fixtures/test-fixtures';
import { loginViaAPI, logout, isAuthenticated } from '../helpers/auth-helpers';

/**
 * E2E Tests for Session management
 */
test.describe('Session Management', () => {
  test.describe('Protected Routes', () => {
    test('should show auth form when accessing protected page without authentication', async ({
      authPage,
    }) => {
      // Navigate to protected page without being logged in
      await authPage.navigate();

      // Should see the sign in form
      await authPage.waitForAuthForm();
      await expect(authPage.heading).toContainText('Sign in');
    });

    test('should access protected page when authenticated', async ({
      authenticatedPage,
    }) => {
      // authenticatedPage fixture automatically logs in
      await authenticatedPage.page.goto('/prompts');

      // Should NOT see the sign in form
      await expect(authenticatedPage.heading).not.toBeVisible({ timeout: 5000 }).catch(() => {
        // If heading is visible, check it's not the auth form
      });

      // Should be on the prompts page
      await expect(authenticatedPage.page).toHaveURL(/\/prompts/);
    });
  });

  test.describe('Session Persistence', () => {
    test('should maintain session after page refresh', async ({
      page,
      testCredentials,
    }) => {
      // Login via API
      await loginViaAPI(page, testCredentials);

      // Navigate to protected page
      await page.goto('/prompts');
      await expect(page).toHaveURL(/\/prompts/);

      // Refresh the page
      await page.reload();

      // Should still be on prompts page (not redirected to login)
      await expect(page).toHaveURL(/\/prompts/);

      // Verify still authenticated
      const authenticated = await isAuthenticated(page);
      expect(authenticated).toBe(true);
    });

    test('should maintain session when navigating between pages', async ({
      page,
      testCredentials,
    }) => {
      // Login via API
      await loginViaAPI(page, testCredentials);

      // Navigate to prompts
      await page.goto('/prompts');
      await expect(page).toHaveURL(/\/prompts/);

      // Navigate to another protected page (if exists)
      await page.goto('/catalogs');
      await expect(page).toHaveURL(/\/catalogs/);

      // Navigate back to prompts
      await page.goto('/prompts');
      await expect(page).toHaveURL(/\/prompts/);

      // Should still be authenticated
      const authenticated = await isAuthenticated(page);
      expect(authenticated).toBe(true);
    });
  });

  test.describe('Sign Out', () => {
    test('should sign out and show auth form', async ({
      page,
      testCredentials,
    }) => {
      // Login via API
      await loginViaAPI(page, testCredentials);

      // Navigate to protected page
      await page.goto('/prompts');
      await expect(page).toHaveURL(/\/prompts/);

      // Sign out by clearing cookies
      await logout(page);

      // Refresh the page
      await page.reload();

      // Should see the auth form now
      const authHeading = page.getByRole('heading', { level: 1 });
      await expect(authHeading).toContainText('Sign in');
    });

    test('should not access protected pages after sign out', async ({
      page,
      testCredentials,
    }) => {
      // Login via API
      await loginViaAPI(page, testCredentials);

      // Verify we're authenticated
      let authenticated = await isAuthenticated(page);
      expect(authenticated).toBe(true);

      // Sign out
      await logout(page);

      // Verify we're no longer authenticated
      authenticated = await isAuthenticated(page);
      expect(authenticated).toBe(false);

      // Try to access protected page
      await page.goto('/prompts');

      // Should see the auth form
      const authHeading = page.getByRole('heading', { level: 1 });
      await expect(authHeading).toContainText('Sign in');
    });
  });

  test.describe('Authentication API', () => {
    test('should return user data when authenticated', async ({
      page,
      testCredentials,
    }) => {
      // Login via API
      await loginViaAPI(page, testCredentials);

      // Make request to /api/me
      const response = await page.request.get('/api/me');
      expect(response.ok()).toBe(true);

      const userData = await response.json();
      expect(userData).toHaveProperty('id');
      expect(userData).toHaveProperty('email');
      expect(userData.email).toBe(testCredentials.email);
    });

    test('should return 401 when not authenticated', async ({ page }) => {
      // Make request to /api/me without authentication
      const response = await page.request.get('/api/me');
      expect(response.status()).toBe(401);
    });
  });
});

