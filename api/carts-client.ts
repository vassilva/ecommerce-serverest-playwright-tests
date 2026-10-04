import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { CartPayload, LoosePayload } from './types';

/**
 * ServeRest links a cart to the user of the token, and the purchase endpoints act on
 * that user's cart. `token` is the `authorization` value returned by POST /login.
 */
export class CartsClient {
  constructor(private readonly request: APIRequestContext) {}

  /** Omit `token` to call anonymously. */
  create(payload: LoosePayload<CartPayload>, token?: string): Promise<APIResponse> {
    return this.request.post('/carrinhos', { data: payload, headers: authHeader(token) });
  }

  getById(id: string): Promise<APIResponse> {
    return this.request.get(`/carrinhos/${encodeURIComponent(id)}`);
  }

  listByUser(idUsuario: string): Promise<APIResponse> {
    return this.request.get('/carrinhos', { params: { idUsuario } });
  }

  /** Deletes the token owner's cart and keeps its stock consumed. */
  completePurchase(token: string): Promise<APIResponse> {
    return this.request.delete('/carrinhos/concluir-compra', { headers: authHeader(token) });
  }

  /** Deletes the token owner's cart and returns its products to stock. */
  cancelPurchase(token: string): Promise<APIResponse> {
    return this.request.delete('/carrinhos/cancelar-compra', { headers: authHeader(token) });
  }
}

function authHeader(token?: string): Record<string, string> {
  return token ? { authorization: token } : {};
}
