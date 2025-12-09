import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for the Home Page
 * Implements the Page Object Model pattern for maintainable tests
 */
export class HomePage extends BasePage {
  // Locators for resilient element selection
  readonly signInButton: Locator;
  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    
    // Define locators using Playwright's built-in methods
    this.signInButton = page.getByRole('button', { name: /sign in/i });
    this.heading = page.getByRole('heading', { level: 1 });
  }

  /**
   * Navigate to home page
   */
  async navigate() {
    await this.goto('/');
    await this.waitForPageLoad();
  }

  /**
   * Click sign in button
   */
  async clickSignIn() {
    await this.signInButton.click();
  }

  /**
   * Check if user is on home page
   */
  async isOnHomePage(): Promise<boolean> {
    return await this.page.url().includes('/');
  }
}

