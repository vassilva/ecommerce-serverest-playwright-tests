import type { LoginResponse, MessageResponse, ValidationErrorResponse } from '../../api/types';
import { expect, test } from '../../fixtures/test';
import { buildUser } from '../../test-data/builders';

test.describe('Login API', { tag: '@api' }, () => {
  test('logs in a registered user and returns a bearer token', { tag: ['@smoke', '@regression', '@sanity'] }, async ({ authApi, seed }) => {
    const user = await seed.user();

    const response = await authApi.login({ email: user.email, password: user.password });

    expect(response.status()).toBe(200);
    const body = (await response.json()) as LoginResponse;
    expect(body.message).toBe('Login realizado com sucesso');
    // Boolean checks keep the token value out of failure output.
    expect(typeof body.authorization === 'string' && body.authorization.startsWith('Bearer '), 'authorization is a Bearer token').toBe(true);
  });

  test('rejects a wrong password', { tag: ['@regression', '@negative'] }, async ({ authApi, seed }) => {
    const user = await seed.user();

    const response = await authApi.login({ email: user.email, password: `${user.password}-wrong` });

    expect(response.status()).toBe(401);
    expect((await response.json()) as MessageResponse).toEqual({ message: 'Email e/ou senha inválidos' });
  });

  test('rejects an email that is not registered', { tag: ['@regression', '@negative'] }, async ({ authApi }) => {
    const unregistered = buildUser();

    const response = await authApi.login({ email: unregistered.email, password: unregistered.password });

    expect(response.status()).toBe(401);
    expect((await response.json()) as MessageResponse).toEqual({ message: 'Email e/ou senha inválidos' });
  });

  test('rejects a request without credentials', { tag: ['@regression', '@negative'] }, async ({ authApi }) => {
    const response = await authApi.login({});

    expect(response.status()).toBe(400);
    expect((await response.json()) as ValidationErrorResponse).toEqual({
      email: 'email é obrigatório',
      password: 'password é obrigatório',
    });
  });
});
