# Task 1: SkillHub boundary hardening report

## Status

DONE_WITH_CONCERNS

## Files changed

- `src/lib/skillhub.js`
  - Added `normalizeSkillHubAuthor` to turn string, object, missing, and malformed author values into a trimmed display string with the stable `社区作者` fallback.
  - Updated `normalizeSkillHubSkill` to use the author boundary and normalize all remote card display/count/dependency fields to safe primitives.
- `src/pages/SkillsPage.jsx`
  - Normalizes remote cards individually and rejects non-record results, so one malformed result does not remove built-ins or valid remote cards.
- `src/components/RouteErrorBoundary.jsx`
  - Added a small class error boundary with a recovery screen and retry action.
- `src/App.jsx`
  - Wrapped the `/skills` route in the error boundary.
- `package.json`, `package-lock.json`, `vitest.config.js`, `test/setup.js`
  - Added the minimal Vitest/jsdom/Testing Library test setup and `npm test` script.
- `test/skillhub.test.js`
  - Added author normalization coverage for the observed object shape, strings, missing values, and malformed values.
- `test/skills-page.test.jsx`
  - Added component coverage for object-valued authors, unavailable SkillHub responses, mixed malformed/valid remote cards, and object-valued display/count/dependency fields.
- `test/app-error-boundary.test.jsx`
  - Added route recovery coverage for a child render failure and retry recovery.

The pre-existing untracked `docs/plans/` directory was left untouched.

## RED

Each behavior was tested before its implementation or was revalidated against the pre-fix implementation.

1. `npm test -- test/skillhub.test.js`
   - Expected failure: 2 tests failed. The object-valued author was returned as an object, and whitespace was not trimmed; the missing/malformed fallback assertion was also not reached in the same test.
2. `npm test -- test/app-error-boundary.test.jsx`
   - Expected failure: 1 test failed because the malformed Skills child propagated `Error: malformed remote card` instead of rendering a recovery screen.
3. `npm test -- test/skills-page.test.jsx` with the author normalization line temporarily restored to the baseline implementation
   - Expected failure: the object-author component test failed with React's `Objects are not valid as a React child` error. The baseline also demonstrated that a malformed card caused the valid remote card to be dropped.
4. `npm test -- test/skills-page.test.jsx` after adding per-card normalization handling but before final verification
   - Expected failure before the guard: 1 test failed because `Valid Remote` was absent when the first remote card was `null`.

## GREEN

1. `npm test -- test/skillhub.test.js`
   - Passed: 1 file, 2 tests.
2. `npm test -- test/app-error-boundary.test.jsx`
   - Passed: 1 file, 1 test.
3. `npm test -- test/skills-page.test.jsx`
   - Passed: 1 file, 3 tests.

## Full verification

- `npm test`
  - Passed: 3 test files, 6 tests.
- `npm run lint`
  - Passed with no lint errors.
- `npm run build`
  - Passed; Vite produced the production bundle.
- `git diff --check`
  - Passed with no whitespace errors.

## Concerns

- `npm install` reports 17 dependency audit findings (5 moderate, 11 high, 1 critical). These are dependency-tree findings and were not addressed because remediation is outside Task 1 scope.
- The production build continues to emit existing large-chunk warnings. No unrelated bundling changes were made.
- The normalized author object is intentionally not copied into a second UI-facing field because the current Skills UI only needs the display string; the raw structured metadata remains available from the upstream response if a later feature needs it.

## Commit

Implementation commit: `3f2036f`.

## Reviewer remediation (round 1)

The independent review requested protection for non-author remote fields and an explicit retry recovery assertion.

### RED

1. `npm test -- test/skills-page.test.jsx test/app-error-boundary.test.jsx`
   - Expected failure before the remediation: 2 tests failed. Object-valued `name`/`description`/`category` and object-valued `version`/count/dependency fields reached React and caused `Objects are not valid as a React child`; the valid card could not be found after the malformed card crashed rendering.
2. `npm test -- test/app-error-boundary.test.jsx` with the retry handler temporarily disabled
   - Expected failure: the recovery screen remained after clicking `重试`, so `Skills recovered` was absent.

### GREEN

1. `npm test -- test/app-error-boundary.test.jsx test/skills-page.test.jsx`
   - Passed: 2 files, 6 tests.
2. The remediation normalizes text, counts, dependencies, labels, and URL values before they enter the Skills state; non-record remote results are discarded before normalization.

### Remediation verification

- `npm test`
  - Passed: 3 test files, 8 tests.
- `npm run lint`
  - Passed with no lint errors.
- `npm run build`
  - Passed; Vite produced the production bundle with the existing large-chunk warnings.
- `git diff --check`
  - Passed with no whitespace errors.

Remediation commit hash will be recorded in the follow-up report commit.
