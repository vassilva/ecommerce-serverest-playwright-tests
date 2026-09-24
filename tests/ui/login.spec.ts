import type { MessageResponse } from '../../api/types';
import { expect, test } from '../../fixtures/test';
import { AdminHomePage } from '../../pages/admin-home-page';
import { LoginPage } from '../../pages/login-page';
import { StoreHomePage } from '../../pages/store-home-page';
import { buildUser } from '../../test-data/builders';

test.describe('Login UI', { tag: '@ui' }, () => {
  test('logs an administrator into the admin area', { tag: ['@smoke', '@regression', '@sanity'] }, async ({ page, seed }) => {
    const admin = await seed.user({ administrador: 'true' });
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    const response = await loginPage.login(admin);

    expect(response.status()).toBe(200);
    await expect(page).toHaveURL(/\/admin\/home$/);
    await expect(new AdminHomePage(page).welcomeHeading(admin.nome)).toBeVisible();
  });

  test('logs a regular user into the store', { tag: '@regression' }, async ({ page, seed }) => {
    const user = await seed.user({ administrador: 'false' });
    const loginPage = new LoginPage(page);
    const store = new StoreHomePage(page);

    await loginPage.goto();
    const response = await loginPage.login(user);

    expect(response.status()).toBe(200);
    await expect(page).toHaveURL(/\/home$/);
    await expect(store.shoppingListLink).toBeVisible();
    await expect(store.logoutButton).toBeVisible();
    await expect(new AdminHomePage(page).registerProductsLink).toHaveCount(0);
  });

  test('rejects invalid credentials and stays on the login page', { tag: ['@regression', '@negative'] }, async ({ page }) => {
    const unregistered = buildUser();
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    const response = await loginPage.login(unregistered);

    expect(response.status()).toBe(401);
    expect((await response.json()) as MessageResponse).toEqual({ message: 'Email e/ou senha inválidos' });
    await expect(loginPage.errorAlert).toContainText('Email e/ou senha inválidos');
    await expect(page).toHaveURL(/\/login$/);
  });
});
