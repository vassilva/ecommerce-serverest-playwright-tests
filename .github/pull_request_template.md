# Summary

<!-- What was changed and why. -->

## Traceability

Test Case / Jira ID: <!-- real ID, or N/A. Never invent one. -->

## Automation Strategy

<!-- For changes to automated tests. Write N/A for other changes. -->

- Automation rationale:
- Layer: API / UI
- Tags:
- Coverage added/changed:

See [docs/automation-workflow.md](../docs/automation-workflow.md) for the decision criteria and tag meanings.

## Local Validation

- [ ] `npm run quality` passed (lint + format check + typecheck)
- [ ] Relevant Playwright test(s) passed locally (spec file or `-g "<title>"`)
- [ ] New test(s) appear in `npm run test:regression -- --list` (or the exclusion is explained below)

## Test Quality

- [ ] Assertions validate the intended behavior
- [ ] Test data is isolated (builders / `seed`)
- [ ] Created resources, including rejected attempts, are registered for cleanup
- [ ] Existing fixtures, API clients and Page Objects are reused where appropriate
- [ ] No fixed waits were introduced
- [ ] No credentials or secrets were introduced

## Review

<!-- Completed by the reviewer. Jenkins does not replace this review. -->

- [ ] Test strategy reviewed (worth automating, no unnecessary duplication)
- [ ] API/UI choice reviewed
- [ ] Tags reviewed
- [ ] Traceability reviewed, when applicable

## Evidence / Notes

<!-- Non-sensitive evidence, limitations or known risks.
     Do not paste tokens, passwords, cookies, or reports/screenshots containing them. -->
