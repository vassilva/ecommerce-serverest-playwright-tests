import type { Response } from '@playwright/test';
import { environment } from '../config/environment';

/**
 * Matches a response the front-end received from the ServeRest API.
 * The origin must equal SERVEREST_API_URL, so UI waits fail loudly if the UI
 * talks to a different backend than the one used for API setup/cleanup.
 */
export function isApiResponse(response: Response, method: string, pathname: string): boolean {
  const url = new URL(response.url());
  return url.origin === environment.apiUrl && url.pathname === pathname && response.request().method() === method;
}
