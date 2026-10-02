/**
 * Target Check for the Jenkins Verify stage: one read-only GET per public ServeRest
 * origin, run before any Playwright test, so an unreachable target is reported as
 * "PUBLIC TARGET UNAVAILABLE" instead of as many failed (and retried) tests.
 *
 * It proves reachability only, never application correctness. No credentials, no
 * retries, no writes, and no test data is created.
 *
 * The default origins mirror config/environment.ts, which Node cannot import here
 * (only Playwright's TypeScript transpiler loads it); keep the two in sync.
 *
 * Usage: node ci/target-check.mts
 */

const TIMEOUT_MS = 10_000;

interface Target {
  label: 'API' | 'UI';
  variable: string;
  fallback: string;
  path: string;
  /** Checks an HTTP 200 response; returns a problem description, or undefined when healthy. */
  verify: (response: Response) => Promise<string | undefined> | string | undefined;
}

const targets: Target[] = [
  {
    label: 'API',
    variable: 'SERVEREST_API_URL',
    fallback: 'https://serverest.dev',
    // A product name that no test creates, so the search result stays tiny.
    path: `/produtos?nome=${encodeURIComponent('QA PW target-check probe')}`,
    verify: async (response) => {
      type ListBody = { quantidade?: unknown; produtos?: unknown } | null | undefined;
      const body = (await response.json().catch(() => undefined)) as ListBody;
      return typeof body?.quantidade === 'number' && Array.isArray(body.produtos)
        ? undefined
        : 'unexpected response body (expected a ServeRest product list)';
    },
  },
  {
    label: 'UI',
    variable: 'SERVEREST_UI_URL',
    fallback: 'https://front.serverest.dev',
    path: '/',
    verify: (response) => {
      const type = response.headers.get('content-type') ?? '';
      return type.includes('text/html') ? undefined : `unexpected content type "${type}"`;
    },
  },
];

/** Same rules as config/environment.ts; a URL with credentials is rejected without being printed. */
function origin(target: Target): string {
  const raw = process.env[target.variable]?.trim() || target.fallback;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${target.variable} must be an absolute http(s) URL.`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error(`${target.variable} must use http or https.`);
  if (url.username || url.password) throw new Error(`${target.variable} must not contain credentials.`);
  if (url.pathname !== '/' || url.search || url.hash) throw new Error(`${target.variable} must be an origin only.`);
  return url.origin;
}

/** Classifies a fetch failure; fetch puts the socket error code (ENOTFOUND, ECONNREFUSED, ...) on `cause`. */
function describeFailure(error: unknown): string {
  const cause = error instanceof Error ? (error.cause as { code?: unknown } | undefined) : undefined;
  const code = typeof cause?.code === 'string' ? cause.code : undefined;
  if ((error instanceof Error && error.name === 'TimeoutError') || code === 'UND_ERR_CONNECT_TIMEOUT') {
    return `TIMEOUT: no response within ${TIMEOUT_MS / 1000}s`;
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return `DNS: host could not be resolved (${code})`;
  return `NETWORK: ${code ?? (error instanceof Error ? error.message : String(error))}`;
}

async function check(target: Target, base: string): Promise<string | undefined> {
  const where = `${target.label} target ${base} (${target.variable})`;
  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(`${base}${target.path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    return `${where} is unreachable: ${describeFailure(error)}`;
  }
  const problem = response.status === 200 ? await target.verify(response) : `HTTP ${response.status} (expected 200)`;
  if (problem) return `${where} is unhealthy: ${problem}`;
  console.log(`Target Check: ${target.label} ${base} OK (HTTP 200, ${Date.now() - started} ms)`);
  return undefined;
}

try {
  // Validate both origins before sending any request.
  const resolved = targets.map((target) => ({ target, base: origin(target) }));
  const failures = (await Promise.all(resolved.map(({ target, base }) => check(target, base)))).filter(Boolean);
  if (failures.length > 0) {
    console.error(
      'PUBLIC TARGET UNAVAILABLE: the public ServeRest services are not reachable/healthy, so no tests were run.',
    );
    for (const failure of failures) console.error(`- ${failure}`);
    console.error('This is an environment failure, not an automation or application test failure.');
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`target-check: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
