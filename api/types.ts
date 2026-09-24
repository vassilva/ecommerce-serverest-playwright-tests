/** ServeRest resource and response shapes, as observed from the public API. */

export type AdminFlag = 'true' | 'false';

export interface UserPayload {
  nome: string;
  email: string;
  password: string;
  administrador: AdminFlag;
}

export interface User extends UserPayload {
  _id: string;
}

export interface ProductPayload {
  nome: string;
  preco: number;
  descricao: string;
  quantidade: number;
}

export interface Product extends ProductPayload {
  _id: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface MessageResponse {
  message: string;
}

export interface CreatedResponse extends MessageResponse {
  _id: string;
}

export interface LoginResponse extends MessageResponse {
  authorization: string;
}

export interface UserListResponse {
  quantidade: number;
  usuarios: User[];
}

export interface ProductListResponse {
  quantidade: number;
  produtos: Product[];
}

/** Field-level validation errors, e.g. { email: 'email é obrigatório' }. */
export type ValidationErrorResponse = Record<string, string>;

/** Allows negative tests to send deliberately invalid payloads while keeping field names typed. */
export type LoosePayload<T> = Partial<Record<keyof T, unknown>>;
