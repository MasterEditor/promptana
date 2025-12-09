import { Page, BrowserContext } from '@playwright/test';

/**
 * Auth helpers for E2E tests
 * Provides utility functions for authentication operations
 */

export interface AuthCredentials {
  email: string;
  password: string;
}

/**
 * Get test user credentials from environment variables
 */
export function getTestUserCredentials(): AuthCredentials {
  const email = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_USERNAME and E2E_PASSWORD must be set in .env.test file'
    );
  }

  return { email, password };
}

/**
 * Get test user ID from environment variables
 */
export function getTestUserId(): string {
  const userId = process.env.E2E_USERNAME_ID;

  if (!userId) {
    throw new Error('E2E_USERNAME_ID must be set in .env.test file');
  }

  return userId;
}

/**
 * Login via API and set auth cookies
 * This is faster than UI-based login for tests that need authenticated state
 */
export async function loginViaAPI(
  page: Page,
  credentials?: AuthCredentials
): Promise<boolean> {
  const { email, password } = credentials ?? getTestUserCredentials();

  const response = await page.request.post('/api/auth/login', {
    data: { email, password },
  });

  if (!response.ok()) {
    console.error('Login API failed:', await response.text());
    return false;
  }

  const body = await response.json();

  if (body.accessToken) {
    // Set cookies for authentication
    await page.context().addCookies([
      {
        name: 'sb-access-token',
        value: body.accessToken,
        domain: 'localhost',
        path: '/',
        sameSite: 'Lax',
      },
    ]);

    if (body.refreshToken) {
      await page.context().addCookies([
        {
          name: 'sb-refresh-token',
          value: body.refreshToken,
          domain: 'localhost',
          path: '/',
          sameSite: 'Lax',
        },
      ]);
    }

    return true;
  }

  return false;
}

/**
 * Logout by clearing auth cookies
 */
export async function logout(page: Page): Promise<void> {
  await page.context().clearCookies();
}

/**
 * Logout via API endpoint
 */
export async function logoutViaAPI(page: Page): Promise<boolean> {
  const response = await page.request.post('/api/auth/signout');
  
  if (response.ok()) {
    // Also clear cookies on client side
    await page.context().clearCookies();
    return true;
  }
  
  return false;
}

/**
 * Check if user is authenticated by making a request to /api/me
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const response = await page.request.get('/api/me');
  return response.ok();
}

/**
 * Generate a unique email for test registration
 * Uses timestamp to ensure uniqueness
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-user-${timestamp}-${random}@example.com`;
}

/**
 * Setup authenticated state for a test
 * Returns a function to restore original state after test
 */
export async function setupAuthenticatedState(
  page: Page
): Promise<() => Promise<void>> {
  const success = await loginViaAPI(page);
  
  if (!success) {
    throw new Error('Failed to setup authenticated state');
  }

  return async () => {
    await logout(page);
  };
}

