import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { LoosePayload, ProductPayload } from './types';

export class ProductsClient {
  constructor(private readonly request: APIRequestContext) {}

  /** `token` is the `authorization` value returned by POST /login; omit it to call anonymously. */
  create(payload: LoosePayload<ProductPayload>, token?: string): Promise<APIResponse> {
    return this.request.post('/produtos', { data: payload, headers: authHeader(token) });
  }

  getById(id: string): Promise<APIResponse> {
    return this.request.get(`/produtos/${encodeURIComponent(id)}`);
  }

  searchByName(nome: string): Promise<APIResponse> {
    return this.request.get('/produtos', { params: { nome } });
  }

  delete(id: string, token?: string): Promise<APIResponse> {
    return this.request.delete(`/produtos/${encodeURIComponent(id)}`, { headers: authHeader(token) });
  }
}

function authHeader(token?: string): Record<string, string> {
  return token ? { authorization: token } : {};
}
