import type { Locator, Page } from '@playwright/test';

export class AdminHomePage {
  readonly registerProductsLink: Locator;

  constructor(private readonly page: Page) {
    this.registerProductsLink = page.getByTestId('cadastrar-produtos');
  }

  welcomeHeading(nome: string): Locator {
    return this.page.getByRole('heading', { level: 1, name: `Bem Vindo ${nome}`, exact: true });
  }
}
