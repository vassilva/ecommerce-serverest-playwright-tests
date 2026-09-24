import type { CreatedResponse, MessageResponse, UserListResponse } from '../../api/types';
import { expect, test } from '../../fixtures/test';
import { SignupPage } from '../../pages/signup-page';
import { buildUser } from '../../test-data/builders';

test.describe('Signup UI', { tag: '@ui' }, () => {
  test('registers a new regular user', { tag: ['@smoke', '@regression'] }, async ({ page, usersApi, cleanup }) => {
    const user = buildUser({ administrador: 'false' });
    const signupPage = new SignupPage(page);

    await signupPage.goto();
    const response = await signupPage.register(user);

    expect(response.status()).toBe(201);
    const body = (await response.json()) as CreatedResponse;
    cleanup.user(body._id);
    await expect(signupPage.message('Cadastro realizado com sucesso')).toBeVisible();
    await expect(page).toHaveURL(/\/home$/);

    const lookup = (await (await usersApi.findByEmail(user.email)).json()) as UserListResponse;
    expect(lookup).toEqual({ quantidade: 1, usuarios: [{ ...user, _id: body._id }] });
  });

  test('rejects an email that is already registered', { tag: ['@regression', '@negative'] }, async ({ page, seed }) => {
    const existing = await seed.user();
    const signupPage = new SignupPage(page);

    await signupPage.goto();
    const response = await signupPage.register(buildUser({ email: existing.email }));

    expect(response.status()).toBe(400);
    expect((await response.json()) as MessageResponse).toEqual({ message: 'Este email já está sendo usado' });
    await expect(signupPage.message('Este email já está sendo usado')).toBeVisible();
    await expect(page).toHaveURL(/\/cadastrarusuarios$/);
  });
});
