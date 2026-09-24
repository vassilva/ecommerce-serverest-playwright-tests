import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { Credentials, LoosePayload } from './types';

export class AuthClient {
  constructor(private readonly request: APIRequestContext) {}

  login(credentials: LoosePayload<Credentials>): Promise<APIResponse> {
    return this.request.post('/login', { data: credentials });
  }
}
