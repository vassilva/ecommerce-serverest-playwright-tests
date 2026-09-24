import type { CreatedResponse, MessageResponse, User, UserListResponse, ValidationErrorResponse } from '../../api/types';
import { expect, test } from '../../fixtures/test';
import { buildUser } from '../../test-data/builders';

const SERVEREST_ID = /^[A-Za-z0-9]{16}$/;

test.describe('Users API', { tag: '@api' }, () => {
  test('creates a user with a valid payload', { tag: ['@smoke', '@regression'] }, async ({ usersApi, cleanup }) => {
    const user = buildUser();

    const response = await usersApi.create(user);

    expect(response.status()).toBe(201);
    const body = (await response.json()) as CreatedResponse;
    cleanup.user(body._id);
    expect(body).toEqual({ message: 'Cadastro realizado com sucesso', _id: expect.stringMatching(SERVEREST_ID) });
  });

  test('retrieves a created user by id', { tag: ['@regression', '@sanity'] }, async ({ usersApi, seed }) => {
    const user = await seed.user();

    const response = await usersApi.getById(user._id);

    expect(response.status()).toBe(200);
    expect((await response.json()) as User).toEqual(user);
  });

  test('rejects a duplicate email and keeps a single user', { tag: ['@regression', '@negative'] }, async ({ usersApi, seed }) => {
    const existing = await seed.user();

    const response = await usersApi.create(buildUser({ email: existing.email }));

    expect(response.status()).toBe(400);
    expect((await response.json()) as MessageResponse).toEqual({ message: 'Este email já está sendo usado' });

    const lookup = (await (await usersApi.findByEmail(existing.email)).json()) as UserListResponse;
    expect(lookup).toEqual({ quantidade: 1, usuarios: [existing] });
  });

  test('rejects a payload without required fields', { tag: ['@regression', '@negative'] }, async ({ usersApi }) => {
    const response = await usersApi.create({});

    expect(response.status()).toBe(400);
    expect((await response.json()) as ValidationErrorResponse).toEqual({
      nome: 'nome é obrigatório',
      email: 'email é obrigatório',
      password: 'password é obrigatório',
      administrador: 'administrador é obrigatório',
    });
  });

  test('rejects blank required fields', { tag: ['@regression', '@negative'] }, async ({ usersApi }) => {
    const response = await usersApi.create({ nome: '', email: '', password: '', administrador: '' });

    expect(response.status()).toBe(400);
    expect((await response.json()) as ValidationErrorResponse).toEqual({
      nome: 'nome não pode ficar em branco',
      email: 'email não pode ficar em branco',
      password: 'password não pode ficar em branco',
      administrador: "administrador deve ser 'true' ou 'false'",
    });
  });

  test('rejects an invalid email format', { tag: ['@regression', '@negative'] }, async ({ usersApi }) => {
    const response = await usersApi.create(buildUser({ email: 'not-an-email' }));

    expect(response.status()).toBe(400);
    expect((await response.json()) as ValidationErrorResponse).toEqual({ email: 'email deve ser um email válido' });
  });

  test('deletes a user so it can no longer be retrieved', { tag: '@regression' }, async ({ usersApi, seed }) => {
    const user = await seed.user();

    const response = await usersApi.delete(user._id);

    expect(response.status()).toBe(200);
    expect((await response.json()) as MessageResponse).toEqual({ message: 'Registro excluído com sucesso' });

    const lookup = await usersApi.getById(user._id);
    expect(lookup.status()).toBe(400);
    expect((await lookup.json()) as MessageResponse).toEqual({ message: 'Usuário não encontrado' });
  });
});
