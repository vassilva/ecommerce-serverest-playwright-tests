# Automação ServeRest — Playwright + TypeScript

QA automation laboratory that exercises the public **ServeRest** reference application
(REST API and web front-end) with **Playwright Test** and **TypeScript**.

This is a learning and portfolio project. It is a separate, independent sibling of an
existing Cypress laboratory and deliberately does **not** copy its architecture.

> **About the target.** ServeRest is an external, public reference service maintained by
> its own authors. This repository does not deploy, host or own ServeRest, and no
> production environment is being claimed. Tests run against shared public data, so
> every test creates its own uniquely named data and deletes it afterwards.

## Stack

| Item | Version |
|---|---|
| Node.js | 24.x |
| Playwright Test | 1.63 |
| TypeScript | 7.x (`strict`, type-check only; Playwright transpiles tests itself) |
| Browser | Playwright-bundled Chromium |

No runtime dependencies, no dotenv, no Cucumber, no Allure.

## Targets

| Variable | Default | Used for |
|---|---|---|
| `SERVEREST_API_URL` | `https://serverest.dev` | API tests, and API setup/cleanup for UI tests |
| `SERVEREST_UI_URL` | `https://front.serverest.dev` | Playwright `baseURL` of the UI project |

Both are optional and read in [`config/environment.ts`](config/environment.ts), which only
accepts plain `http(s)` origins (no path, no embedded credentials). No `.env` file is
needed or expected.

The public front-end is hard-wired to call `https://serverest.dev`. UI tests match the
front-end's network calls against `SERVEREST_API_URL`, so pointing the two variables at
different backends makes UI tests fail loudly instead of silently seeding the wrong system.

## Installation

```bash
npm ci
npx playwright install chromium
```

## Scripts

| Script | What it runs |
|---|---|
| `npm test` | Whole suite (API + UI) |
| `npm run test:api` | Tests tagged `@api` |
| `npm run test:ui` | Tests tagged `@ui` (Chromium) |
| `npm run test:smoke` | `@smoke` |
| `npm run test:regression` | `@regression` |
| `npm run test:negative` | `@negative` |
| `npm run test:sanity` | `@sanity` |
| `npm run test:chromium` | The `chromium` (UI) project only |
| `npm run test:headed` | UI project in a visible browser |
| `npm run test:ui-mode` | Playwright's interactive UI mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run report` | Opens the last HTML report |

Extra Playwright arguments can be passed after `--`, e.g. `npm run test:api -- --list`.

## Project structure

```
config/environment.ts     Target URLs (env vars + public defaults, validated)
api/                      Focused API clients (users, auth, products) + response types
fixtures/test.ts          Custom Playwright fixtures: API clients, cleanup, seed
support/
  resource-tracker.ts     Per-test cleanup of exactly the resources a test created
  seeder.ts               API setup helpers (user, admin session, product)
  network.ts              Matches the front-end's calls to the ServeRest API
test-data/builders.ts     Unique fake users and products
pages/                    Lean Page Objects (locators + actions, no business assertions)
tests/api/                API specs  -> Playwright project "api"
tests/ui/                 UI specs   -> Playwright project "chromium"
```

**API layer.** One small client per resource (`UsersClient`, `AuthClient`,
`ProductsClient`) wraps a dedicated `APIRequestContext` bound to `SERVEREST_API_URL`.
Clients return raw `APIResponse` objects so tests assert exact status codes and bodies.

**UI layer.** Page Objects expose locators and user actions; assertions stay in the
specs. Prerequisite data (users, products) is created through the API, the behavior is
verified through the UI, and cleanup happens through the API.

## Tags

Tags use Playwright's native `tag` option and are selected with `--grep`.

| Tag | Meaning | Planned CI use |
|---|---|---|
| `@api` / `@ui` | Layer under test | Layer-specific jobs |
| `@smoke` | Fast critical happy paths | Feature branches |
| `@regression` | The regression pack (currently every test) | Pull requests |
| `@negative` | Rejection/validation behavior | Subset reporting |
| `@sanity` | Minimal post-merge / post-deployment check | `main`, SIT smoke |

A test only carries the tags that describe it; overlap between tags is expected.

## Test data

[`test-data/builders.ts`](test-data/builders.ts) creates unique values from a timestamp
and a random UUID fragment, e.g. `QA PW User lz3k9a-1f2e3d4c` /
`qa.pw.lz3k9a-1f2e3d4c@example.com`. No Faker, no real personal data, no shared static
accounts, and no dependency on pre-existing ServeRest records. The `example.com` domain is
reserved for documentation (RFC 2606). Passwords are random fake test values.

## Cleanup

- Every created user or product is registered with the per-test `ResourceTracker`
  (via the `seed` fixture, or explicitly with `cleanup.user(id)` / `cleanup.product(id, token)`).
- Cleanup runs in the `cleanup` fixture teardown, so it runs whether the test passes or fails.
- Resources are deleted newest-first, which removes products before the admin user whose
  token deletes them.
- Every deletion is verified. Failures are collected, and reported as a separate error
  **alongside** any test failure, never instead of it.
- Only ids the test itself created are deleted. There is no bulk or pattern-based deletion.

## Reports and diagnostics

- Console: `list` reporter. HTML report in `playwright-report/` (never auto-opens).
- `trace: 'retain-on-failure'` and `screenshot: 'only-on-failure'`: evidence is kept only
  for failed tests, in `test-results/`.
- Retries: 0 locally, 2 when `CI` is set (Playwright's generated default).

## Security posture

- No secrets are needed, stored or committed. There is no `.env` file; `.env*` (except
  `.env.example`) and `.auth/` are git-ignored in advance.
- All credentials used are fake, generated per test, and belong to throwaway users on
  the public test service.
- Login tests check the token's shape with a boolean assertion so the token value never
  appears in failure output.
- Traces and reports can contain the fake test tokens and request data. They are local
  artifacts and are git-ignored.

## Current limitations

- **CI/CD is not implemented yet.** A Jenkins pipeline is planned for a later phase
  (feature branch → smoke → PR → regression → merge → `main` → sanity → manual approval →
  simulated SIT deployment → SIT smoke → simulated UAT promotion → release evidence). SIT
  and UAT will be simulated; they are not real environments.
- Tests depend on the availability and shared state of the public ServeRest services.
- Only Chromium is configured.
- No ESLint/Prettier yet.
- UI coverage is intentionally small: login, signup, product search, shopping list.
