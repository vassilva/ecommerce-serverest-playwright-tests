import type {
  CreatedResponse,
  MessageResponse,
  Product,
  ProductListResponse,
  ValidationErrorResponse,
} from '../../api/types';
import type { ProductsClient } from '../../api/products-client';
import { expect, test } from '../../fixtures/test';
import { buildProduct } from '../../test-data/builders';

const SERVEREST_ID = /^[A-Za-z0-9]{16}$/;
const INVALID_TOKEN_MESSAGE = 'Token de acesso ausente, inválido, expirado ou usuário do token não existe mais';

async function expectNoProductNamed(productsApi: ProductsClient, nome: string): Promise<void> {
  const response = await productsApi.searchByName(nome);
  expect(response.status()).toBe(200);
  expect((await response.json()) as ProductListResponse).toEqual({ quantidade: 0, produtos: [] });
}

test.describe('Products API', { tag: '@api' }, () => {
  test(
    'allows an administrator to create a product',
    { tag: ['@smoke', '@regression'] },
    async ({ productsApi, seed, cleanup }) => {
      const { token } = await seed.adminSession();
      const product = buildProduct();

      const response = await productsApi.create(product, token);
      const body = (await response.json()) as CreatedResponse;
      cleanup.productFromCreation(body, token);

      expect(response.status()).toBe(201);
      expect(body).toEqual({ message: 'Cadastro realizado com sucesso', _id: expect.stringMatching(SERVEREST_ID) });
    },
  );

  test('retrieves a created product by id', { tag: '@regression' }, async ({ productsApi, seed }) => {
    const { token } = await seed.adminSession();
    const product = await seed.product(token);

    const response = await productsApi.getById(product._id);

    expect(response.status()).toBe(200);
    expect((await response.json()) as Product).toEqual(product);
  });

  test('finds a created product by exact name', { tag: ['@regression', '@sanity'] }, async ({ productsApi, seed }) => {
    const { token } = await seed.adminSession();
    const product = await seed.product(token);

    const response = await productsApi.searchByName(product.nome);

    expect(response.status()).toBe(200);
    expect((await response.json()) as ProductListResponse).toEqual({ quantidade: 1, produtos: [product] });
  });

  test(
    'rejects product creation without a token',
    { tag: ['@regression', '@negative'] },
    async ({ productsApi, seed, cleanup }) => {
      // Admin session only so an unexpectedly created product can still be cleaned up.
      const { token: adminToken } = await seed.adminSession();
      const product = buildProduct();

      const response = await productsApi.create(product);
      const body = (await response.json()) as MessageResponse;
      cleanup.productFromCreation(body, adminToken);

      expect(response.status()).toBe(401);
      expect(body).toEqual({ message: INVALID_TOKEN_MESSAGE });
      await expectNoProductNamed(productsApi, product.nome);
    },
  );

  test(
    'rejects product creation by a non-administrator',
    { tag: ['@regression', '@negative'] },
    async ({ productsApi, seed, cleanup }) => {
      // Admin session only so an unexpectedly created product can still be cleaned up.
      const { token: adminToken } = await seed.adminSession();
      const regularUser = await seed.user({ administrador: 'false' });
      const token = await seed.token(regularUser);
      const product = buildProduct();

      const response = await productsApi.create(product, token);
      const body = (await response.json()) as MessageResponse;
      cleanup.productFromCreation(body, adminToken);

      expect(response.status()).toBe(403);
      expect(body).toEqual({ message: 'Rota exclusiva para administradores' });
      await expectNoProductNamed(productsApi, product.nome);
    },
  );

  test(
    'rejects a product with a duplicate name',
    { tag: ['@regression', '@negative'] },
    async ({ productsApi, seed, cleanup }) => {
      const { token } = await seed.adminSession();
      const existing = await seed.product(token);

      const response = await productsApi.create(buildProduct({ nome: existing.nome }), token);
      const body = (await response.json()) as MessageResponse;
      cleanup.productFromCreation(body, token);

      expect(response.status()).toBe(400);
      expect(body).toEqual({ message: 'Já existe produto com esse nome' });

      const search = (await (await productsApi.searchByName(existing.nome)).json()) as ProductListResponse;
      expect(search).toEqual({ quantidade: 1, produtos: [existing] });
    },
  );

  test(
    'rejects a product with a negative price',
    { tag: ['@regression', '@negative'] },
    async ({ productsApi, seed, cleanup }) => {
      const { token } = await seed.adminSession();
      const product = buildProduct({ preco: -1 });

      const response = await productsApi.create(product, token);
      const body = (await response.json()) as ValidationErrorResponse;
      cleanup.productFromCreation(body, token);

      expect(response.status()).toBe(400);
      expect(body).toEqual({ preco: 'preco deve ser um número positivo' });
      await expectNoProductNamed(productsApi, product.nome);
    },
  );

  test('deletes a product so it can no longer be retrieved', { tag: '@regression' }, async ({ productsApi, seed }) => {
    const { token } = await seed.adminSession();
    const product = await seed.product(token);

    const response = await productsApi.delete(product._id, token);

    expect(response.status()).toBe(200);
    expect((await response.json()) as MessageResponse).toEqual({ message: 'Registro excluído com sucesso' });

    const lookup = await productsApi.getById(product._id);
    expect(lookup.status()).toBe(400);
    expect((await lookup.json()) as MessageResponse).toEqual({ message: 'Produto não encontrado' });
  });
});
