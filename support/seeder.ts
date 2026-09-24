import { expect } from '@playwright/test';
import type { AuthClient } from '../api/auth-client';
import type { ProductsClient } from '../api/products-client';
import type { UsersClient } from '../api/users-client';
import type { Credentials, CreatedResponse, LoginResponse, Product, ProductPayload, User, UserPayload } from '../api/types';
import { buildProduct, buildUser } from '../test-data/builders';
import type { ResourceTracker } from './resource-tracker';

export interface AdminSession {
  user: User;
  token: string;
}

/**
 * Arranges prerequisite data through the API and registers every created
 * resource for cleanup. Fails fast with a clear message if setup itself breaks,
 * so a setup problem is never reported as a behavior failure.
 */
export class Seeder {
  constructor(
    private readonly users: UsersClient,
    private readonly auth: AuthClient,
    private readonly products: ProductsClient,
    private readonly tracker: ResourceTracker,
  ) {}

  async user(overrides: Partial<UserPayload> = {}): Promise<User> {
    const payload = buildUser(overrides);
    const response = await this.users.create(payload);
    expect(response.status(), 'seed: POST /usuarios should return 201').toBe(201);
    const body = (await response.json()) as CreatedResponse;
    this.tracker.user(body._id);
    return { ...payload, _id: body._id };
  }

  async token(credentials: Credentials): Promise<string> {
    const response = await this.auth.login({ email: credentials.email, password: credentials.password });
    expect(response.status(), 'seed: POST /login should return 200').toBe(200);
    return ((await response.json()) as LoginResponse).authorization;
  }

  async adminSession(): Promise<AdminSession> {
    const user = await this.user({ administrador: 'true' });
    return { user, token: await this.token(user) };
  }

  async product(adminToken: string, overrides: Partial<ProductPayload> = {}): Promise<Product> {
    const payload = buildProduct(overrides);
    const response = await this.products.create(payload, adminToken);
    expect(response.status(), 'seed: POST /produtos should return 201').toBe(201);
    const body = (await response.json()) as CreatedResponse;
    this.tracker.product(body._id, adminToken);
    return { ...payload, _id: body._id };
  }
}
