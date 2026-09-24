import type { Locator, Page, Response } from '@playwright/test';
import type { UserPayload } from '../api/types';
import { isApiResponse } from '../support/network';

export class SignupPage {
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly adminCheckbox: Locator;
  readonly submitButton: Locator;

  constructor(private readonly page: Page) {
    this.nameInput = page.getByTestId('nome');
    this.emailInput = page.getByTestId('email');
    this.passwordInput = page.getByTestId('password');
    this.adminCheckbox = page.getByRole('checkbox', { name: 'Cadastrar como administrador?' });
    this.submitButton = page.getByTestId('cadastrar');
  }

  async goto(): Promise<void> {
    await this.page.goto('/cadastrarusuarios');
  }

  /** Submits the form and returns the API response for POST /usuarios. */
  async register(user: UserPayload): Promise<Response> {
    await this.nameInput.fill(user.nome);
    await this.emailInput.fill(user.email);
    await this.passwordInput.fill(user.password);
    await this.adminCheckbox.setChecked(user.administrador === 'true');
    const [response] = await Promise.all([
      this.page.waitForResponse((r) => isApiResponse(r, 'POST', '/usuarios')),
      this.submitButton.click(),
    ]);
    return response;
  }

  message(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }
}
