import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { LoosePayload, UserPayload } from './types';

export class UsersClient {
  constructor(private readonly request: APIRequestContext) {}

  create(payload: LoosePayload<UserPayload>): Promise<APIResponse> {
    return this.request.post('/usuarios', { data: payload });
  }

  getById(id: string): Promise<APIResponse> {
    return this.request.get(`/usuarios/${encodeURIComponent(id)}`);
  }

  findByEmail(email: string): Promise<APIResponse> {
    return this.request.get('/usuarios', { params: { email } });
  }

  delete(id: string): Promise<APIResponse> {
    return this.request.delete(`/usuarios/${encodeURIComponent(id)}`);
  }
}
