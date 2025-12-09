import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for the Authentication form (Sign In / Sign Up)
 * Based on SignInRequiredPanel component
 */
export class AuthPage extends BasePage {
  // Form inputs
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  
  // Buttons
  readonly submitButton: Locator;
  readonly switchToSignUpLink: Locator;
  readonly switchToSignInLink: Locator;
  
  // Messages
  readonly statusContainer: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  
  // Field errors
  readonly emailError: Locator;
  readonly passwordError: Locator;
  readonly confirmPasswordError: Locator;
  
  // Heading
  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    
    // Form inputs
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.confirmPasswordInput = page.locator('#confirm-password');
    
    // Buttons - using more specific selectors
    this.submitButton = page.locator('button[type="submit"]');
    this.switchToSignUpLink = page.locator('button:has-text("Sign up")').filter({ hasNotText: /signing/i });
    this.switchToSignInLink = page.locator('button:has-text("Sign in")').filter({ hasNotText: /signing/i });
    
    // Status messages container
    this.statusContainer = page.locator('[role="status"]');
    this.errorMessage = page.locator('[role="status"] .text-red-600, [role="status"] .text-red-400');
    this.successMessage = page.locator('[role="status"] .text-green-600, [role="status"] .text-green-400');
    
    // Field-level errors
    this.emailError = page.locator('#email-error');
    this.passwordError = page.locator('#password-error');
    this.confirmPasswordError = page.locator('#confirm-password-error');
    
    // Heading
    this.heading = page.getByRole('heading', { level: 1 });
  }

  /**
   * Navigate to a protected page to trigger auth form
   */
  async navigate() {
    await this.goto('/prompts');
    await this.waitForPageLoad();
  }

  /**
   * Fill email and password, then submit the sign in form
   */
  async signIn(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /**
   * Switch to sign up mode, fill form, and submit
   */
  async signUp(email: string, password: string, confirmPassword: string) {
    await this.switchToSignUp();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword);
    await this.submitButton.click();
  }

  /**
   * Switch from Sign In to Sign Up mode
   */
  async switchToSignUp() {
    await this.switchToSignUpLink.click();
    await expect(this.heading).toContainText('Create an account');
  }

  /**
   * Switch from Sign Up to Sign In mode
   */
  async switchToSignIn() {
    await this.switchToSignInLink.click();
    await expect(this.heading).toContainText('Sign in');
  }

  /**
   * Get the error message for a specific field
   */
  async getFieldError(field: 'email' | 'password' | 'confirmPassword'): Promise<string | null> {
    const errorLocator = {
      email: this.emailError,
      password: this.passwordError,
      confirmPassword: this.confirmPasswordError,
    }[field];

    if (await errorLocator.isVisible()) {
      return await errorLocator.textContent();
    }
    return null;
  }

  /**
   * Get the main error message from status container
   */
  async getErrorMessage(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return await this.errorMessage.textContent();
    }
    return null;
  }

  /**
   * Get the success message from status container
   */
  async getSuccessMessage(): Promise<string | null> {
    if (await this.successMessage.isVisible()) {
      return await this.successMessage.textContent();
    }
    return null;
  }

  /**
   * Check if we're in Sign In mode
   */
  async isInSignInMode(): Promise<boolean> {
    const headingText = await this.heading.textContent();
    return headingText?.includes('Sign in') ?? false;
  }

  /**
   * Check if we're in Sign Up mode
   */
  async isInSignUpMode(): Promise<boolean> {
    const headingText = await this.heading.textContent();
    return headingText?.includes('Create an account') ?? false;
  }

  /**
   * Check if the form is currently submitting (loading state)
   */
  async isSubmitting(): Promise<boolean> {
    const buttonText = await this.submitButton.textContent();
    return buttonText?.includes('…') ?? false;
  }

  /**
   * Wait for auth form to be visible
   */
  async waitForAuthForm() {
    await expect(this.heading).toBeVisible();
    await expect(this.emailInput).toBeVisible();
  }

  /**
   * Wait for successful navigation after auth
   */
  async waitForAuthSuccess() {
    // After successful auth, we should be redirected to /prompts
    await this.page.waitForURL('**/prompts**');
  }

  /**
   * Check if submit button is disabled
   */
  async isSubmitButtonDisabled(): Promise<boolean> {
    return await this.submitButton.isDisabled();
  }

  /**
   * Check if email input is disabled
   */
  async areInputsDisabled(): Promise<boolean> {
    return await this.emailInput.isDisabled();
  }
}

