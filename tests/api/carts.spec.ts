import type { CartsClient } from '../../api/carts-client';
import type { ProductsClient } from '../../api/products-client';
import type { Cart, CartListResponse, CreatedResponse, MessageResponse, Product, User } from '../../api/types';
import { expect, test } from '../../fixtures/test';
import { withoutPassword } from '../../support/redaction';

const SERVEREST_ID = /^[A-Za-z0-9]{16}$/;

async function stockOf(productsApi: ProductsClient, id: string): Promise<number> {
  const response = await productsApi.getById(id);
  expect(response.status(), `GET /produtos/${id}`).toBe(200);
  return ((await response.json()) as Product).quantidade;
}

async function expectNoCart(cartsApi: CartsClient, id: string): Promise<void> {
  const response = await cartsApi.getById(id);
  expect(response.status()).toBe(400);
  expect((await response.json()) as MessageResponse).toEqual({ message: 'Carrinho não encontrado' });
}

test.describe('Carts API', { tag: '@api' }, () => {
  test(
    'creates a cart that reserves stock and records prices and totals',
    { tag: '@regression' },
    async ({ cartsApi, productsApi, seed, cleanup }) => {
      const { token: adminToken } = await seed.adminSession();
      const first = await seed.product(adminToken, { quantidade: 10 });
      const second = await seed.product(adminToken, { quantidade: 5 });
      const shopper = await seed.user();
      const token = await seed.token(shopper);

      const response = await cartsApi.create(
        {
          produtos: [
            { idProduto: first._id, quantidade: 3 },
            { idProduto: second._id, quantidade: 1 },
          ],
        },
        token,
      );
      const body = (await response.json()) as CreatedResponse;
      cleanup.cartFromCreation(body, token);

      expect(response.status()).toBe(201);
      expect(body).toEqual({ message: 'Cadastro realizado com sucesso', _id: expect.stringMatching(SERVEREST_ID) });
      expect(await stockOf(productsApi, first._id)).toBe(7);
      expect(await stockOf(productsApi, second._id)).toBe(4);

      const lookup = await cartsApi.getById(body._id);
      expect(lookup.status()).toBe(200);
      expect((await lookup.json()) as Cart).toEqual({
        _id: body._id,
        idUsuario: shopper._id,
        produtos: [
          { idProduto: first._id, quantidade: 3, precoUnitario: first.preco },
          { idProduto: second._id, quantidade: 1, precoUnitario: second.preco },
        ],
        precoTotal: first.preco * 3 + second.preco,
        quantidadeTotal: 4,
      });
    },
  );

  test(
    'cancels a purchase, restoring stock and removing the cart',
    { tag: '@regression' },
    async ({ cartsApi, productsApi, seed }) => {
      const { token: adminToken } = await seed.adminSession();
      const product = await seed.product(adminToken, { quantidade: 10 });
      const token = await seed.token(await seed.user());
      const cartId = await seed.cart(token, [{ idProduto: product._id, quantidade: 3 }]);
      expect(await stockOf(productsApi, product._id), 'stock reserved by the cart').toBe(7);

      const response = await cartsApi.cancelPurchase(token);

      expect(response.status()).toBe(200);
      expect((await response.json()) as MessageResponse).toEqual({
        message: 'Registro excluído com sucesso. Estoque dos produtos reabastecido',
      });
      expect(await stockOf(productsApi, product._id)).toBe(10);
      await expectNoCart(cartsApi, cartId);
    },
  );

  test(
    'completes a purchase, keeping stock consumed and removing the cart',
    { tag: '@regression' },
    async ({ cartsApi, productsApi, seed }) => {
      const { token: adminToken } = await seed.adminSession();
      const product = await seed.product(adminToken, { quantidade: 10 });
      const token = await seed.token(await seed.user());
      const cartId = await seed.cart(token, [{ idProduto: product._id, quantidade: 3 }]);

      const response = await cartsApi.completePurchase(token);

      expect(response.status()).toBe(200);
      expect((await response.json()) as MessageResponse).toEqual({ message: 'Registro excluído com sucesso' });
      expect(await stockOf(productsApi, product._id)).toBe(7);
      await expectNoCart(cartsApi, cartId);
    },
  );

  test(
    'rejects a cart atomically when one product lacks stock',
    { tag: ['@regression', '@negative'] },
    async ({ cartsApi, productsApi, seed, cleanup }) => {
      const { token: adminToken } = await seed.adminSession();
      const available = await seed.product(adminToken, { quantidade: 10 });
      const scarce = await seed.product(adminToken, { quantidade: 2 });
      const shopper = await seed.user();
      const token = await seed.token(shopper);

      const response = await cartsApi.create(
        {
          produtos: [
            { idProduto: available._id, quantidade: 1 },
            { idProduto: scarce._id, quantidade: 3 },
          ],
        },
        token,
      );
      const body = (await response.json()) as MessageResponse;
      cleanup.cartFromCreation(body, token);

      expect(response.status()).toBe(400);
      expect(body).toEqual({
        message: 'Produto não possui quantidade suficiente',
        item: { idProduto: scarce._id, quantidade: 3, quantidadeEstoque: 2, index: 1 },
      });
      expect(await stockOf(productsApi, available._id)).toBe(10);
      expect(await stockOf(productsApi, scarce._id)).toBe(2);
      const carts = await cartsApi.listByUser(shopper._id);
      expect((await carts.json()) as CartListResponse).toEqual({ quantidade: 0, carrinhos: [] });
    },
  );

  test(
    'rejects a second cart for the same user',
    { tag: ['@regression', '@negative'] },
    async ({ cartsApi, productsApi, seed, cleanup }) => {
      const { token: adminToken } = await seed.adminSession();
      const inCart = await seed.product(adminToken, { quantidade: 10 });
      const other = await seed.product(adminToken, { quantidade: 5 });
      const shopper = await seed.user();
      const token = await seed.token(shopper);
      const cartId = await seed.cart(token, [{ idProduto: inCart._id, quantidade: 2 }]);

      const response = await cartsApi.create({ produtos: [{ idProduto: other._id, quantidade: 1 }] }, token);
      const body = (await response.json()) as MessageResponse;
      cleanup.cartFromCreation(body, token);

      expect(response.status()).toBe(400);
      expect(body).toEqual({ message: 'Não é permitido ter mais de 1 carrinho' });
      expect(await stockOf(productsApi, other._id)).toBe(5);
      expect(await stockOf(productsApi, inCart._id)).toBe(8);

      const original = await cartsApi.getById(cartId);
      expect(original.status()).toBe(200);
      expect((await original.json()) as Cart).toEqual({
        _id: cartId,
        idUsuario: shopper._id,
        produtos: [{ idProduto: inCart._id, quantidade: 2, precoUnitario: inCart.preco }],
        precoTotal: inCart.preco * 2,
        quantidadeTotal: 2,
      });
    },
  );

  test('refuses to delete a user who has a cart', { tag: ['@regression', '@negative'] }, async ({ usersApi, seed }) => {
    const { token: adminToken } = await seed.adminSession();
    const product = await seed.product(adminToken, { quantidade: 10 });
    const shopper = await seed.user();
    const token = await seed.token(shopper);
    const cartId = await seed.cart(token, [{ idProduto: product._id, quantidade: 1 }]);

    const response = await usersApi.delete(shopper._id);

    expect(response.status()).toBe(400);
    expect((await response.json()) as MessageResponse).toEqual({
      message: 'Não é permitido excluir usuário com carrinho cadastrado',
      idCarrinho: cartId,
    });

    const lookup = await usersApi.getById(shopper._id);
    expect(lookup.status()).toBe(200);
    expect(withoutPassword((await lookup.json()) as User)).toEqual(withoutPassword(shopper));
  });

  test(
    'refuses to delete a product that is in a cart',
    { tag: ['@regression', '@negative'] },
    async ({ productsApi, seed }) => {
      const { token: adminToken } = await seed.adminSession();
      const product = await seed.product(adminToken, { quantidade: 10 });
      const token = await seed.token(await seed.user());
      const cartId = await seed.cart(token, [{ idProduto: product._id, quantidade: 1 }]);

      const response = await productsApi.delete(product._id, adminToken);

      expect(response.status()).toBe(400);
      expect((await response.json()) as MessageResponse).toEqual({
        message: 'Não é permitido excluir produto que faz parte de carrinho',
        idCarrinhos: [cartId],
      });

      const lookup = await productsApi.getById(product._id);
      expect(lookup.status()).toBe(200);
      expect((await lookup.json()) as Product).toEqual({ ...product, quantidade: 9 });
    },
  );
});
