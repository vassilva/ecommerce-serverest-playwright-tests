import { randomInt, randomUUID } from 'node:crypto';
import type { ProductPayload, UserPayload } from '../api/types';

/**
 * Lightweight fake-data builders. Every value is unique per call and clearly
 * identifiable as automation data ("QA PW" prefix, reserved example.com domain).
 */

export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

export function buildUser(overrides: Partial<UserPayload> = {}): UserPayload {
  const suffix = uniqueSuffix();
  return {
    nome: `QA PW User ${suffix}`,
    email: `qa.pw.${suffix}@example.com`,
    password: `Pw-${randomUUID().slice(0, 12)}`,
    administrador: 'false',
    ...overrides,
  };
}

export function buildProduct(overrides: Partial<ProductPayload> = {}): ProductPayload {
  const suffix = uniqueSuffix();
  return {
    nome: `QA PW Product ${suffix}`,
    preco: randomInt(10, 1000),
    descricao: `Playwright lab product ${suffix}`,
    quantidade: randomInt(1, 100),
    ...overrides,
  };
}
