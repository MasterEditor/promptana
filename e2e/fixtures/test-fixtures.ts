import { test as base } from '@playwright/test';
import { HomePage } from '../page-objects/HomePage';
import { AuthPage } from '../page-objects/AuthPage';
import {
  loginViaAPI,
  logout,
  getTestUserCredentials,
  AuthCredentials,
} from '../helpers/auth-helpers';

/**
 * Custom test fixtures for extending Playwright test functionality
 * Use fixtures to set up test environment and provide reusable utilities
 */

type CustomFixtures = {
  /** Home page object */
  homePage: HomePage;
  /** Auth page object (Sign In / Sign Up form) */
  authPage: AuthPage;
  /** Test user credentials from environment */
  testCredentials: AuthCredentials;
  /** Pre-authenticated page - automatically logs in before test */
  authenticatedPage: AuthPage;
};

/**
 * Extended test with custom fixtures
 * Usage: import { test, expect } from './fixtures/test-fixtures';
 */
export const test = base.extend<CustomFixtures>({
  homePage: async ({ page }, use) => {
    const homePage = new HomePage(page);
    await use(homePage);
  },

  authPage: async ({ page }, use) => {
    const authPage = new AuthPage(page);
    await use(authPage);
  },

  testCredentials: async ({}, use) => {
    const credentials = getTestUserCredentials();
    await use(credentials);
  },

  authenticatedPage: async ({ page }, use) => {
    // Login via API before test
    const success = await loginViaAPI(page);
    if (!success) {
      throw new Error('Failed to authenticate for test');
    }

    const authPage = new AuthPage(page);
    await use(authPage);

    // Cleanup: logout after test
    await logout(page);
  },
});

export { expect } from '@playwright/test';
