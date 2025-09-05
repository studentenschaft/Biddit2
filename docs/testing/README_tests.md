# Biddit2 Test Suite — Developer Guide

This README summarizes the current testing setup, what’s covered, and how to run/debug tests locally. It complements the strategy in `docs/testing/TESTING_STRATEGY.md`.

## Overview
- Test runner: Vitest with jsdom and React Testing Library.
- Integration network control: MSW (Mock Service Worker, node adapter).
- State management in tests: Recoil with `renderWithProviders` helper.
- Scope covered now: core domain helpers, unified course data hook, axios client interceptors.

See full strategy: `docs/testing/TESTING_STRATEGY.md:1`

## Tooling
- Runner: `vitest` (`app/vitest.config.js:1`) with `jsdom`, globals, and `setupFiles`.
- DOM: `@testing-library/react`, `@testing-library/jest-dom`.
- Mocks: `msw` with node server bootstrapped in setup.
- Optional: run serial/single-thread on macOS sandbox if worker pool causes issues.

Key configs and setup:
- `app/vitest.config.js:1`
- `app/src/test/setup.js:1`

## Directory Layout
- Unit and integration tests are co-located under `app/src`.
- Test utilities and MSW live under `app/tests`.

Important paths:
- `app/src/components/helpers/__tests__/calculateGrades.test.js:1`
- `app/src/components/helpers/__tests__/useUnifiedCourseData.int.test.jsx:1`
- `app/src/components/helpers/__tests__/axiosClient.int.test.js:1`
- `app/tests/utils/renderWithProviders.jsx:1`
- `app/tests/msw/server.js:1`
- `app/tests/msw/handlers/index.js:1`

## Running Tests
From the `app` folder:
- All tests: `npm run test`
- Run once + coverage: `npm run coverage`
- If macOS sandbox complains about workers, run serially:
  - `npm run test -- --run --pool=threads --poolOptions.threads.singleThread=true`

## What’s Covered (Current)
1) Core domain helpers (Unit)
- `calculateGrades.js` invariants:
  - Exclude Campus/Practice credits and passed courses (`gradeText` includes P).
  - Support custom grade override function.
  - Handle nested title items and thesis placeholder (`maxCredits`).
  - Semester credits sum from mixed fields.

2) Unified Course Data Hook (Integration)
- `useUnifiedCourseData.js` behaviors:
  - Initialize semester with defaults and metadata.
  - Flatten nested courses and zero ECTS for exercise groups.
  - Mark enrolled/selected flags, sort filtered results accordingly.
  - Uses Recoil state + React Testing Library `renderHook`.

3) Axios Client Interceptors (Integration with MSW)
- `axiosClient.js` + mocked `tokenService.js`:
  - Default headers + Authorization added on GET.
  - 401 triggers single refresh via `getRefreshToken`, retries with new token.
  - Refresh failure triggers `handleAuthFailure` and propagates error.

## MSW Setup and Usage
- The node server is started/stopped in the global setup:
  - `app/src/test/setup.js:1`
  - `app/tests/msw/server.js:1`
- Handlers can be registered globally in `app/tests/msw/handlers/index.js:1` or per test using `server.use(...)`.
- Example (see `axiosClient.int.test.js:1`):
  - `server.use(http.get('http://test.local/endpoint', handler))`.

## Rendering with Recoil Providers
- Use `renderWithProviders` or `createWrapper` to provide `RecoilRoot` and optional initial state in tests:
  - `app/tests/utils/renderWithProviders.jsx:1`
- Example (see `useUnifiedCourseData.int.test.jsx:1`):
  - `const { result } = renderHook(() => useUnifiedCourseData(), { wrapper: createWrapper() })`.

## Patterns and Guidelines
- AAA pattern (Arrange, Act, Assert): used across tests.
- Async state (Recoil) updates: prefer `act(...)` and `waitFor(...)` around state transitions.
- Avoid UI snapshots; assert on behavior and accessible DOM.
- Keep tests deterministic: no real network, time control as needed.

## Commands Reference
- Run all tests: `cd app && npm run test`
- Coverage: `cd app && npm run coverage`
- Serial fallback: `cd app && npm run test -- --run --pool=threads --poolOptions.threads.singleThread=true`

## Troubleshooting
- Worker errors on macOS sandbox: use the serial fallback flag above.
- MSW not intercepting: ensure `server.listen()` is called (see `setup.js`) and the URL in handlers matches exactly.
- Header assertions: some adapters omit `Content-Type` on GET; assert only relevant headers.

## Next Steps (High Impact Backlog)
- Events: Add tests for `useEventListDataManager.js` and `EventListContainer.jsx` (date ranges, filtering, empty/loading states).
- Data unification: MSW-backed tests for `useUnifiedCourseLoader.js` + `useTermSelection.js` contract behavior (no real network).
- Error handling/a11y: `ErrorBoundary.jsx`, `ErrorToast.jsx`, redaction checks; `jest-axe` on key pages.
- Property-based tests: invariants for `calculateGrades.js` and `smartExerciseGroupHandler.js` (using `fast-check`).

For the full vision, rationale, and coverage thresholds, see `docs/testing/TESTING_STRATEGY.md:1`.
