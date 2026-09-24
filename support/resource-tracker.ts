import type { APIResponse } from '@playwright/test';
import type { ProductsClient } from '../api/products-client';
import type { UsersClient } from '../api/users-client';
import type { MessageResponse } from '../api/types';

/** ServeRest answers 200 with one of these messages; the second means it was already gone. */
const ACCEPTED_DELETE_MESSAGES = new Set(['Registro excluído com sucesso', 'Nenhum registro excluído']);

interface CleanupTask {
  description: string;
  run: () => Promise<void>;
}

/**
 * Records exactly the resources a test created and deletes them afterwards,
 * newest first (products before the admin user whose token deletes them).
 * One instance per test; never shared between tests.
 */
export class ResourceTracker {
  private readonly tasks: CleanupTask[] = [];

  constructor(
    private readonly users: UsersClient,
    private readonly products: ProductsClient,
  ) {}

  user(id: string): void {
    this.tasks.push({
      description: `user ${id}`,
      run: async () => verifyDeleted(`DELETE /usuarios/${id}`, await this.users.delete(id)),
    });
  }

  product(id: string, adminToken: string): void {
    this.tasks.push({
      description: `product ${id}`,
      run: async () => verifyDeleted(`DELETE /produtos/${id}`, await this.products.delete(id, adminToken)),
    });
  }

  /**
   * Registers a user from a creation response body before the test asserts on it,
   * so an unexpected status that still created the user cannot leak it.
   */
  userFromCreation(body: unknown): void {
    const id = createdId(body);
    if (id) this.user(id);
  }

  productFromCreation(body: unknown, adminToken: string): void {
    const id = createdId(body);
    if (id) this.product(id, adminToken);
  }

  /** Runs every task even if some fail, and returns the failures instead of throwing. */
  async cleanup(): Promise<string[]> {
    const failures: string[] = [];
    for (const task of this.tasks.splice(0).reverse()) {
      try {
        await task.run();
      } catch (error) {
        failures.push(`${task.description}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return failures;
  }
}

function createdId(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('_id' in body)) return undefined;
  return typeof body._id === 'string' && body._id.length > 0 ? body._id : undefined;
}

async function verifyDeleted(label: string, response: APIResponse): Promise<void> {
  const body = (await response.json().catch(() => ({}))) as Partial<MessageResponse>;
  if (response.status() !== 200 || !body.message || !ACCEPTED_DELETE_MESSAGES.has(body.message)) {
    throw new Error(`${label} returned ${response.status()} "${body.message ?? '<no message>'}"`);
  }
}
