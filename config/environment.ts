/**
 * Target configuration for the public ServeRest reference services.
 *
 * Values come from environment variables with safe public defaults, so no
 * .env file is required. Only origins are accepted (no path, no credentials).
 */

function readOrigin(variableName: string, fallback: string): string {
  const raw = process.env[variableName]?.trim() || fallback;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${variableName} must be an absolute http(s) URL.`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${variableName} must use http or https.`);
  }
  if (url.username || url.password) {
    throw new Error(`${variableName} must not contain credentials.`);
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${variableName} must be an origin only (for example https://serverest.dev).`);
  }

  return url.origin;
}

export const environment = {
  /** ServeRest REST API, used for API tests and for UI test setup/cleanup. */
  apiUrl: readOrigin('SERVEREST_API_URL', 'https://serverest.dev'),
  /** ServeRest front-end, used as Playwright baseURL for UI tests. */
  uiUrl: readOrigin('SERVEREST_UI_URL', 'https://front.serverest.dev'),
} as const;
