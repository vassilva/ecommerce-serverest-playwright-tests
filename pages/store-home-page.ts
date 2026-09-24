import type { Locator, Page } from '@playwright/test';
import { isApiResponse } from '../support/network';

/** Regular-user store page (/home). */
export class StoreHomePage {
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly shoppingListLink: Locator;
  readonly logoutButton: Locator;
  readonly productCards: Locator;
  readonly noProductsMessage: Locator;

  constructor(private readonly page: Page) {
    this.searchInput = page.getByTestId('pesquisar');
    this.searchButton = page.getByTestId('botaoPesquisar');
    this.shoppingListLink = page.getByTestId('lista-de-compras');
    this.logoutButton = page.getByTestId('logout');
    // Cards expose no role or test id; the Bootstrap "card" class is the only stable container.
    this.productCards = page.locator('.card');
    this.noProductsMessage = page.getByText('Nenhum produto foi encontrado', { exact: true });
  }

  /**
   * Loads /home and waits for the full product list to arrive. Searching before
   * that initial response lands lets it overwrite the search results.
   */
  async open(): Promise<void> {
    await Promise.all([
      this.page.waitForResponse((r) => isApiResponse(r, 'GET', '/produtos') && new URL(r.url()).search === ''),
      this.page.goto('/home'),
    ]);
  }

  async search(nome: string): Promise<void> {
    await this.searchInput.fill(nome);
    await Promise.all([
      this.page.waitForResponse(
        (r) => isApiResponse(r, 'GET', '/produtos') && new URL(r.url()).searchParams.get('nome') === nome,
      ),
      this.searchButton.click(),
    ]);
  }

  productCard(nome: string): Locator {
    return this.productCards.filter({ has: this.page.getByRole('heading', { name: nome, exact: true }) });
  }

  async addToList(nome: string): Promise<void> {
    await this.productCard(nome).getByRole('button', { name: 'Adicionar a lista' }).click();
  }
}
