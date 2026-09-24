import { test as base, type APIRequestContext } from '@playwright/test';
import { AuthClient } from '../api/auth-client';
import { ProductsClient } from '../api/products-client';
import { UsersClient } from '../api/users-client';
import { environment } from '../config/environment';
import { ResourceTracker } from '../support/resource-tracker';
import { Seeder } from '../support/seeder';

interface ServeRestFixtures {
  /** API context bound to SERVEREST_API_URL, independent of the project's (UI) baseURL. */
  apiRequest: APIRequestContext;
  usersApi: UsersClient;
  authApi: AuthClient;
  productsApi: ProductsClient;
  /** Deletes the resources this test registered, after the test body finishes (pass or fail). */
  cleanup: ResourceTracker;
  seed: Seeder;
}

export const test = base.extend<ServeRestFixtures>({
  apiRequest: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({ baseURL: environment.apiUrl });
    await use(context);
    await context.dispose();
  },
  usersApi: async ({ apiRequest }, use) => {
    await use(new UsersClient(apiRequest));
  },
  authApi: async ({ apiRequest }, use) => {
    await use(new AuthClient(apiRequest));
  },
  productsApi: async ({ apiRequest }, use) => {
    await use(new ProductsClient(apiRequest));
  },
  cleanup: async ({ usersApi, productsApi }, use) => {
    const tracker = new ResourceTracker(usersApi, productsApi);
    await use(tracker);
    const failures = await tracker.cleanup();
    if (failures.length > 0) {
      // Reported alongside (never instead of) any failure from the test body.
      throw new Error(`Cleanup failed for ${failures.length} resource(s):\n- ${failures.join('\n- ')}`);
    }
  },
  seed: async ({ usersApi, authApi, productsApi, cleanup }, use) => {
    await use(new Seeder(usersApi, authApi, productsApi, cleanup));
  },
});

export { expect } from '@playwright/test';
