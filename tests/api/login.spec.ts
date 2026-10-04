import type { LoginResponse, MessageResponse } from '../../api/types';
import { expect, test } from '../../fixtures/test';
import { buildUser } from '../../test-data/builders';

test.describe('Login API', { tag: '@api' }, () => {
  test(
    'logs in a registered user and returns a bearer token',
    { tag: ['@smoke', '@regression'] },
    async ({ authApi, seed }) => {
      const user = await seed.user();

      const response = await authApi.login({ email: user.email, password: user.password });

      expect(response.status()).toBe(200);
      const body = (await response.json()) as LoginResponse;
      expect(body.message).toBe('Login realizado com sucesso');
      // Boolean checks keep the token value out of failure output.
      expect(
        typeof body.authorization === 'string' && body.authorization.startsWith('Bearer '),
        'authorization is a Bearer token',
      ).toBe(true);
    },
  );

  // Both cases must get the same answer, so a response never reveals whether an email is registered.
  test(
    'rejects a wrong password and an unknown email with the same response',
    { tag: ['@regression', '@negative'] },
    async ({ authApi, seed }) => {
      const user = await seed.user();
      const unregistered = buildUser();

      await test.step('registered email with a wrong password', async () => {
        const response = await authApi.login({ email: user.email, password: `${user.password}-wrong` });
        expect(response.status(), 'wrong password').toBe(401);
        expect((await response.json()) as MessageResponse, 'wrong password').toEqual({
          message: 'Email e/ou senha inválidos',
        });
      });

      await test.step('email that is not registered', async () => {
        const response = await authApi.login({ email: unregistered.email, password: unregistered.password });
        expect(response.status(), 'unknown email').toBe(401);
        expect((await response.json()) as MessageResponse, 'unknown email').toEqual({
          message: 'Email e/ou senha inválidos',
        });
      });
    },
  );
});
