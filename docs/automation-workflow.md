# Automated Test Development Workflow

## 1. Purpose

This document defines how a **new** automated test moves from a Test Case to merged
Playwright automation in this repository. It keeps the following consistent across
contributions:

- traceability between Test Cases and automated tests;
- deliberate decisions about what to automate;
- the right test layer (API or UI);
- consistent tagging;
- maintainable code that reuses the existing architecture;
- reliable CI validation.

It describes process only. Stack, scripts, architecture, tags, cleanup and the Jenkins
pipeline are documented in the [README](../README.md) and are linked here rather than repeated.

## 2. Workflow overview

```text
Requirement / Story
  → Test Case (and its Jira/Test Case ID, when one exists)
  → Automation Candidate Analysis → automate or not?
  → API/UI decision
  → Tag selection
  → Feature branch
  → Playwright implementation
  → Local validation
  → Pull Request
  → Human Code Review + Jenkins PR validation (both required before merge)
  → Merge
  → main pipeline
```

Code Review and Jenkins validation are separate checks. Neither replaces the other.

## 3. Test Case traceability

A **Test Case** is the functional scenario being validated. It may live in Jira or in
another test-management process outside this repository.

**Traceability** here is deliberately simple: when a real Test Case ID exists, it may
prefix the Playwright test title. Tags stay in the `tag` option, as in every existing spec.
For a hypothetical new scenario:

```ts
test(
  'ABC-123 - rejects a product without a description',
  { tag: ['@regression', '@negative'] },
  async ({ productsApi, seed, cleanup }) => {
    // ...
  },
);
```

`ABC-123` and the scenario are illustrative placeholders. Because Playwright's `--grep` matches titles, the ID
also works as a local filter: `npx playwright test --grep ABC-123`.

This is traceability only, not integration:

- the repository has no Jira, Xray or Zephyr integration and does not update Jira or any
  test-management tool with results;
- never invent an ID, and use one only if it refers to a real Test Case;
- existing tests have no IDs, and they must not be retrofitted with placeholder IDs;
- when no ID exists, write `N/A` in the Pull Request.

## 4. Automation Candidate Analysis

Not every Test Case should be automated. Before writing code, weigh the scenario against
these factors:

| Factor                     | Favors automation                                        | Argues against automation                        |
| -------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| Business criticality       | Failure would block core use (login, create)             | Cosmetic or rarely used behavior                 |
| Regression frequency       | Scenario is repeatedly validated across sprints/releases | Rarely needs to be revalidated                   |
| Stability / determinism    | Same input always gives the same result                  | Depends on timing, shared state or external flux |
| Repeatability              | Can run many times with fresh, isolated data             | Needs one-off setup or unique real-world data    |
| Data variation             | Many input combinations of the same rule                 | A single, one-time check                         |
| Automation feasibility     | Reachable through existing clients/Page Objects          | Needs capabilities the project does not have     |
| Maintenance cost           | Low: stable contract or stable selectors                 | High: volatile layout or copy                    |
| Visual / subjective nature | Objective, assertable outcome                            | Judged by eye (look and feel, usability)         |
| Execution value            | Catches real defects cheaply and repeatedly              | Duplicates coverage that already exists          |

A team may score these factors (for example, 1–3 each) to structure the discussion. A score
supports the decision but does not make it; the QA engineer's judgment decides. Record the
rationale in the Pull Request, and a decision _not_ to automate is equally valid.

ServeRest is a public service with shared data. A scenario that depends on pre-existing records
or on global state (for example, total record counts) cannot be made deterministic here.

## 5. API vs UI decision

**Prefer API** (`tests/api/`, Playwright project `api`) when the behavior can be validated
reliably below the UI without losing the purpose of the Test Case: business rules,
authorization, input validation, negative cases, status codes, response bodies and data
combinations.

**Use UI** (`tests/ui/`, Playwright project `chromium`) when the user journey or
browser-visible behavior is itself under test: navigation, form interaction, messages
shown to the user, rendered search results or empty states. Following the existing UI
specs, prerequisite data is still created through the API (`seed`) and cleaned up through
the API. Only the behavior under test goes through the browser.

**Avoid duplication.** Do not repeat an API-verified business rule at UI level unless the UI
adds something the API test cannot show. For example, the API suite covers several login
rejection cases, while the UI suite covers only that the user sees the error.

## 6. Tagging strategy

Tags are chosen **during test design and implementation, and reviewed before merge**. They
are not assigned after sprint closure. A test usually carries several tags.

Tags use Playwright's native `tag` option (see the [README tag table](../README.md#tags)).
The layer tag is set once on `test.describe`, and the other tags on each `test`.

| Tag           | Actual use in this repository                                                                                                | Use it when                                                                                  | Do not use it when                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `@api`        | On every `test.describe` in `tests/api/`. Selected by `npm run test:api`.                                                    | The spec lives in `tests/api/`, which already inherits it from its `describe`.               | The test is a UI test.                                                                                   |
| `@ui`         | On every `test.describe` in `tests/ui/`. Selected by `npm run test:ui`.                                                      | The spec lives in `tests/ui/`, which already inherits it from its `describe`.                | The test is an API test.                                                                                 |
| `@regression` | Carried by **every** current test. **This is the tag Jenkins runs on Pull Requests.**                                        | Always, unless there is an explicit, reviewed reason to exclude the test from PR validation. | The test is exploratory or temporarily unreliable (fix it first rather than merging it).                 |
| `@negative`   | Rejection and validation cases: wrong credentials, missing token, duplicates, blank or invalid fields, empty search results. | The expected outcome is that the system refuses or reports an error/empty result.            | The happy path succeeds.                                                                                 |
| `@smoke`      | One fast, critical happy path per spec file. Runs on feature-branch builds and in SIT Smoke on `main` after an APPROVE.      | The test is a new critical happy path that is not already represented in `@smoke`.           | Negative cases, secondary paths, or anything that makes smoke slower without adding critical confidence. |
| `@sanity`     | A minimal subset (login via API and UI, user lookup, product search). Drives the **Main Sanity** gate on `main`.             | The test replaces or fills a gap in that minimal post-merge check.                           | By default. A failing sanity test blocks the release-authorization step on `main`.                       |

Keep `@smoke` and `@sanity` intentionally selective. Importance alone does not qualify a
test. Most new tests end up as `@regression`, optionally with `@negative`, plus the layer tag
inherited from their `describe`.

Current tag membership can be checked at any time without running tests:

```bash
npm run test:regression -- --list
```

## 7. Feature branch

Develop new automation on a feature branch, never directly on `main`. Changes reach `main`
through a Pull Request.

The repository has no mandatory branch naming convention. A non-mandatory example:
`test/products-duplicate-name`.

## 8. Implementation guidelines

Follow the existing architecture described in the README
([Project structure](../README.md#project-structure), [Test data](../README.md#test-data),
[Cleanup](../README.md#cleanup), [Security posture](../README.md#security-posture)):

- **Fixtures.** Import `test` and `expect` from `fixtures/test.ts`, not from
  `@playwright/test`. Use the `usersApi`, `authApi`, `productsApi`, `seed` and `cleanup`
  fixtures.
- **API clients.** Call ServeRest through the clients in `api/`. Extend a client if an
  endpoint is missing, and add response types to `api/types.ts`.
- **Page Objects.** UI interactions go through `pages/`. Page Objects hold locators and
  actions, and assertions stay in the specs. Prefer `getByTestId` and `getByRole` locators,
  as the existing Page Objects do.
- **Test data.** Build data with `test-data/builders.ts`. Do not use static accounts, real
  personal data or records that already exist in ServeRest.
- **Isolation and cleanup.** Create prerequisites with `seed`. Register every creation
  _attempt_, including those expected to be rejected, with `cleanup` before asserting its
  status. Delete only what the test created.
- **Assertions.** Assert exact status codes and bodies, and use web-first assertions in UI
  tests. An assertion must prove the behavior in the Test Case, not just that a call returned.
- **Waits.** Do not use fixed waits. Wait on a locator assertion or on the specific network
  response, as `LoginPage.login` does.
- **Independence.** Each test must pass alone, in any order and in parallel. Do not share
  state between tests.
- **Secrets.** Do not use hardcoded real credentials, and do not log tokens or passwords.
  Follow the existing boolean checks for tokens and passwords (see
  [Security posture](../README.md#security-posture)).

ESLint enforces several of these rules automatically (see
[Static quality gates](../README.md#static-quality-gates)). Do not add `eslint-disable`
comments.

## 9. Local validation

Run the static gates, then only the tests that are relevant to the change. You do not need
to run the whole suite for a single new test.

```bash
npm run quality                                     # lint + format:check + typecheck
npx playwright test tests/api/products.spec.ts      # the spec file you changed
npx playwright test -g "<test title>"                  # a single test by title
npm run test:regression -- --list                   # confirm the new test is selected by @regression
```

The individual gates are also available as `npm run lint`, `npm run format:check` and
`npm run typecheck`. `npm run format:fix` and `npm run lint:fix` apply automatic fixes.

Local validation does not replace Jenkins. Tests run against the public ServeRest services,
so a local failure can also be caused by the service being unavailable. Investigate before
retrying.

## 10. Human Code Review

A human reviews every Pull Request **before merge**. Jenkins only confirms that the code
builds and the selected tests pass. It does not judge whether the test is the right test.

### Test Strategy Review

- Should this scenario be automated at all? Is the rationale recorded?
- Is API or UI the right layer? Does it duplicate existing coverage?
- Are the tags correct: `@regression` present, `@negative` accurate, `@smoke`/`@sanity`
  justified if added?
- If a Test Case ID is used, is it real and does it match the scenario?
- Does the test validate meaningful business behavior?

### Technical Review

- Assertions are specific and prove the intended behavior.
- Tests are isolated and independent, and data comes from builders or `seed`.
- Every created resource, including rejected attempts, is registered for cleanup.
- Locators are stable, and there are no fixed waits.
- API responses are checked for status and body, and types are used for response bodies.
- Existing fixtures, clients and Page Objects are reused, with no parallel helpers.
- Code is strictly typed and readable, without unnecessary duplication.
- No credentials, tokens or passwords are hardcoded or printed.

## 11. Pull Request

Open the PR with the [pull request template](../.github/pull_request_template.md). It
asks for:

- the Test Case or Jira ID, or `N/A`;
- the behavior automated and why it was worth automating;
- the layer (API/UI) and the selected tags;
- local validation performed, as a checklist or a short summary of results;
- known limitations or risks, such as dependence on public ServeRest data.

Evidence must be non-sensitive. Do not paste tokens, passwords, cookies or reports or
screenshots that contain them.

## 12. Jenkins PR validation

For a Pull Request, the [`Jenkinsfile`](../Jenkinsfile) runs **Install → Quality → Target Check →
Regression**:

- `npm ci`
- `npm run quality`
- `node ci/target-check.mts` (checks that the public ServeRest API and UI are reachable; see the
  [README CI/CD section](../README.md#cicd-jenkins))
- `npm run test:regression` (smoke is a subset of regression and is not run separately)

A failed Target Check means the public target was unavailable. It is not a failure of the
change under review, so re-run the build once the service is back. A passing Target Check
does not prove that the tests will pass.

Jenkins sets `CI=true`, so Playwright uses 2 retries and 2 workers, and JUnit results are
published. The lab Jenkins discovers branches and PRs through periodic Multibranch scans,
not webhooks, so a build can start with a delay. Feature-branch builds (builds that are not a
change request) run **Install → Quality → Target Check → Smoke** instead.

Jenkins selects tests by tag, not from a list. A new test with `@regression` joins the PR
regression run automatically once it is on the branch under test. If the regression pack
has _N_ tests, it has _N + 1_ after the change. A test without `@regression` is **not**
executed during PR validation.

A test that passes only on retry is reported as flaky and should be investigated before
merge.

## 13. Merge and `main`

Merge only after the Human Code Review is approved and the Jenkins PR build passes.

On `main`, the pipeline runs **Install → Quality → Target Check → Main Sanity** (`npm run test:sanity`),
then waits for **Manual Deployment Authorization**. The later release stages are described
in the [README CI/CD section](../README.md#cicd-jenkins). A new test affects them only
through its tags:

- `@sanity` tests run in Main Sanity, and a failure stops the build before authorization;
- `@smoke` tests run once more in SIT Smoke, after an APPROVE.

Test execution is real. Deployment and promotion are **simulated**:

- ServeRest is an external, public service. This project does not own, host or deploy it.
- There is no real SIT deployment. "Simulated SIT Deployment" only records evidence, and
  SIT Smoke runs against the public ServeRest target.
- There is no real UAT promotion. "Simulated UAT Promotion" only records evidence.
- No real deployment is performed. Evidence files state `deploymentMode: simulated` and
  `realDeploymentPerformed: false`.

## 14. Definition of Done for a new automated test

- [ ] Test Case or relevant requirement identified
- [ ] Automation decision justified (Section 4)
- [ ] API/UI layer chosen appropriately, without unjustified duplicate coverage
- [ ] Tags selected: layer tag via `describe`, `@regression`, plus `@negative`/`@smoke`/`@sanity` only when they apply
- [ ] Real Test Case ID in the title when one exists, and no invented IDs
- [ ] Existing fixtures, API clients, Page Objects and builders reused
- [ ] Assertions validate the intended behavior
- [ ] Test data is unique and isolated
- [ ] Test-owned created resources are registered for cleanup, when applicable
- [ ] No secrets or sensitive information introduced
- [ ] `npm run quality` passed
- [ ] Relevant local tests passed
- [ ] Pull Request opened with the template completed
- [ ] Human Code Review approved
- [ ] Jenkins PR validation passed
- [ ] Merged to `main` through the Pull Request
