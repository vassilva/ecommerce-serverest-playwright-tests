import type { Locator, Page, Response } from '@playwright/test';
import type { Credentials } from '../api/types';
import { isApiResponse } from '../support/network';

export class LoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorAlert: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByTestId('email');
    this.passwordInput = page.getByTestId('senha');
    this.submitButton = page.getByTestId('entrar');
    this.errorAlert = page.getByRole('alert');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  /** Submits the form and returns the API response for POST /login. */
  async login(credentials: Credentials): Promise<Response> {
    await this.emailInput.fill(credentials.email);
    await this.passwordInput.fill(credentials.password);
    const [response] = await Promise.all([
      this.page.waitForResponse((r) => isApiResponse(r, 'POST', '/login')),
      this.submitButton.click(),
    ]);
    return response;
  }
}
