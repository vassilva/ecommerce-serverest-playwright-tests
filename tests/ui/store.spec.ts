import { expect, test } from '../../fixtures/test';
import { LoginPage } from '../../pages/login-page';
import { ShoppingListPage } from '../../pages/shopping-list-page';
import { StoreHomePage } from '../../pages/store-home-page';
import { uniqueSuffix } from '../../test-data/builders';

test.describe('Store UI', { tag: '@ui' }, () => {
  test.beforeEach(async ({ page, seed }) => {
    const shopper = await seed.user({ administrador: 'false' });
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    expect((await loginPage.login(shopper)).status(), 'shopper login should succeed').toBe(200);
    await expect(page).toHaveURL(/\/home$/);
  });

  test('finds an existing product by name', { tag: ['@smoke', '@regression'] }, async ({ page, seed }) => {
    const { token } = await seed.adminSession();
    const product = await seed.product(token);
    const store = new StoreHomePage(page);

    await store.open();
    await store.search(product.nome);

    await expect(store.productCards).toHaveCount(1);
    const card = store.productCard(product.nome);
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { name: `$ ${product.preco}`, exact: true })).toBeVisible();
  });

  test('shows an empty state when no product matches', { tag: ['@regression', '@negative'] }, async ({ page }) => {
    const store = new StoreHomePage(page);

    await store.open();
    await store.search(`QA PW no match ${uniqueSuffix()}`);

    await expect(store.noProductsMessage).toBeVisible();
    await expect(store.productCards).toHaveCount(0);
  });

  test(
    'adds a searched product to the shopping list and changes its quantity',
    { tag: '@regression' },
    async ({ page, seed }) => {
      const { token } = await seed.adminSession();
      // Stock above 1 so the quantity can be increased.
      const product = await seed.product(token, { quantidade: 10 });
      const store = new StoreHomePage(page);
      const shoppingList = new ShoppingListPage(page);

      await store.open();
      await store.search(product.nome);
      await store.addToList(product.nome);

      await expect(page).toHaveURL(/\/minhaListaDeProdutos$/);
      await expect(shoppingList.heading).toBeVisible();
      await expect(shoppingList.productNames).toHaveText([`Produto:${product.nome}`]);
      await expect(shoppingList.priceText(product.preco)).toBeVisible();
      await expect(shoppingList.productQuantities).toHaveText(['Total: 1']);

      await shoppingList.increaseQuantityButtons.click();

      await expect(shoppingList.productQuantities).toHaveText(['Total: 2']);
    },
  );
});
