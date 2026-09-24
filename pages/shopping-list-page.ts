import type { Locator, Page } from '@playwright/test';

/** Client-side shopping list (/minhaListaDeProdutos), stored in the browser only. */
export class ShoppingListPage {
  readonly heading: Locator;
  readonly productNames: Locator;
  readonly productQuantities: Locator;
  readonly increaseQuantityButtons: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Lista de Compras' });
    this.productNames = page.getByTestId('shopping-cart-product-name');
    this.productQuantities = page.getByTestId('shopping-cart-product-quantity');
    this.increaseQuantityButtons = page.getByTestId('product-increase-quantity');
  }

  priceText(preco: number): Locator {
    return this.page.getByText(`Preço R$${preco}`, { exact: true });
  }
}
