# Biddit2 Testing Strategy and Architecture

This document defines the testing strategy for Biddit2, grounded in Domain-Driven Design (DDD), Clean Architecture, and the BCS Testing Pyramid. It captures Step 1 of the BCS-Enhanced workflow: Requirements Analysis & Domain Discovery, and establishes the initial decisions for our testing architecture.

## Step 1: Requirements Analysis & Domain Discovery

### BCS Decision Framework
- **Business Impact**: A comprehensive, reliable test suite protects core student workflows (course discovery, study planning, calendar, transcript/grades, and ratings) and reduces time-to-merge, defects in production, and incident MTTR.
- **Technical Debt**: We reduce debt by standardizing tooling (Vitest + React Testing Library already present), establishing clear test structure/patterns, and codifying coverage and quality gates. We avoid snapshot overuse and flaky E2E patterns to prevent future maintenance burden.
- **Team Capability**: The team already uses Vite, Vitest, and React Testing Library. We will build on these and add MSW (API mocking), Playwright (E2E), `fast-check` (property-based) to keep learning curve moderate and documentation clear.
- **Risk Management**: Primary risks are flaky tests (time/network), brittle UI assertions, and API contract drift. Mitigations: deterministic test setup, MSW for API mocks, contract tests for adapters, accessibility checks, and minimal reliance on implementation details in the UI.

### Ubiquitous Language (Initial)
- **Program / Study Program**: A degree program the student pursues.
- **Scorecard**: Aggregated progress and details for a program or enrollment set; includes semesters, credits (ECTS), and course status.
- **Course**: A single course entity with attributes (ECTS, lecturer, language, classification, ratings).
- **Enrollment**: The student’s enrollment for a course/term.
- **Semester / Term**: Time-bounded academic period.
- **Calendar Entry / Event**: Scheduled course-related event (lecture, exercise), shown in calendar and event lists.
- **Ratings**: Aggregated course ratings sourced from SHSG or similar.
- **Study Plan**: A curated set of selected courses per student with planning logic.
- **Unified Academic Data**: Normalized, combined representation from multiple backend endpoints/services.

### Bounded Contexts (Initial)
- **Authentication Context**: MSAL-based login and token handling.
- **Academic Data Context**: Unification of scorecards, enrollments, semesters, transcripts, and course info.
- **Ratings Context**: Course rating retrieval and filtering logic.
- **Study Plan Context**: Planning, selection, and persistence of course choices.
- **Calendar Context**: Calendar/event generation, filtering, and presentation.
- **Error Handling Context**: Centralized error capturing, formatting, and user-facing reporting.

> Note: These are logical testing contexts. They map to code in `app/src/components/helpers`, Recoil selectors/atoms, and UI containers.

### Requirements Specification
- **Summary**: Provide a layered, maintainable test suite that validates domain logic, adapter interactions, and key user journeys without flakiness, aligned with DDD boundaries and Clean Architecture.

#### User Stories and Acceptance Criteria
1) As a developer, I want fast, isolated unit tests for domain logic so I can refactor safely.
   - Acceptance: Unit tests run < 1s for changed modules; follow AAA; cover invariants and error paths; no external I/O.

2) As a developer, I want integration tests for adapters and selectors so regressions in unified data don’t break consumers.
   - Acceptance: Integration tests run with MSW and real selectors/reducers; verify schemas and transformations; minimal mocking of internal details.

3) As a product owner, I want E2E tests for critical user journeys so releases are safe.
   - Acceptance: 5–10 critical scenarios automated; stable locators; retries and timeouts tuned; tests complete < 5 minutes in CI.

4) As a security champion, I want security and input validation tests so we reduce risk of misuse.
   - Acceptance: Negative tests for input validation; auth flows validated; sensitive data not leaked in errors; basic a11y checks on main pages.

5) As an engineer, I want meaningful coverage gates so we balance quality and velocity.
   - Acceptance: Global thresholds (Lines ≥ 80%, Branches ≥ 70%); critical modules flagged for higher coverage; coverage reported in CI.

#### Non-Functional Requirements
- **Performance**: Unit suite typically < 5s total; integration suite < 30s; E2E smoke < 5 min.
- **Stability**: No flaky tests in main branch; deterministic time and network via stubs/msw.
- **Maintainability**: Tests colocated with code or `__tests__` folders; clear naming; helpers/utilities for common patterns.
- **Security**: Basic auth, input validation, and error redaction tests.
- **Scalability**: Suites parallelizable in CI.

#### Mapping to Business Value
- Faster releases with confidence; fewer production incidents; improved onboarding and refactoring ability; lower long-term maintenance costs.

#### Clarifying Questions
1) Which user journeys are business-critical and must be covered in E2E smoke? (Proposed: Login, Course search/filter, Add to Study Plan, View Study Overview, View Course Info, Calendar/Event list render.)
2) What are supported browsers/targets for E2E? (Chromium-only acceptable, or Chromium+WebKit+Firefox?)
3) Is there a stable staging backend for E2E, or should E2E run fully mocked?
4) Desired coverage thresholds beyond proposed defaults? Any per-module critical thresholds?
5) CI environment details (runner OS, caching, parallelism) to optimize test times?
6) Data privacy constraints: any PII in fixtures/logs to avoid/check?

## Testing Architecture (Strategic Choices)

### Tooling (Leverage Existing, Add Where Needed)
- **Unit/Integration**: `Vitest` (already present) with `jsdom` and `@testing-library/react`.
- **DOM Testing**: `React Testing Library` with `@testing-library/jest-dom` (already present).
- **API Mocking**: `MSW` (Mock Service Worker) for integration tests to stabilize network and assert request/response contracts.
- **Property-Based Testing**: `fast-check` for key domain invariants (e.g., grade calculations, credit totals, schedule transformations).
- **E2E**: `Playwright` (recommended) for reliability, trace viewer, and cross-browser support. Alternatively `Cypress` if team prefers.
- **Accessibility**: `axe-core` via `jest-axe` (unit/integration) and Playwright’s `locator` a11y checks where helpful.

### Layering (Clean Architecture Alignment)
- **Domain Layer (Core logic in helpers/selectors)**: Unit tests validate entities/value objects, pure functions, transforms, and invariants. No framework dependencies, no I/O.
- **Application Layer (Hooks/selectors orchestration)**: Integration tests validate composition across Recoil selectors/atoms and adapters with MSW.
- **Infrastructure/Adapters (API clients)**: Contract tests ensure transformations and error handling against mocked backend contracts; validate axios client behavior and auth token service.
- **UI (React components)**: Component tests focus on behavior and accessibility using Testing Library; avoid relying on implementation details and avoid broad snapshots.
- **System/E2E**: Playwright flows across real builds, ideally against a stable test backend or a fully mocked dev server.

### Test Categories and Guidance
- **Unit Tests (70–80%)**
  - Targets: `helpers/*.js`, pure transforms (e.g., `unifiedDataTransforms.js`, `calculateGrades.js`, `createSemesterMap.js`).
  - Patterns: AAA, data-driven tests, property-based for critical rules, fake timers for date/time.
  - Speed: must be fast and isolated.

- **Integration Tests (15–25%)**
  - Targets: Recoil selectors and hooks (e.g., `useUnifiedCourseData.js`, `useCourseInfoData.js`, `useEventListDataManager.js`), axios client behavior, token/headers.
  - Tools: `MSW` to stub endpoints; verify request shapes and transformation correctness.
  - Scope: Span multiple modules within the same bounded context without external side effects.

- **System/E2E (5–10%)**
  - Targets: Critical end-user journeys across contexts.
  - Tools: Playwright with stable locators and trace collection.
  - Data: Prefer stable staging with seeded data or full mock of backend through dev server.

### Directory Structure and Conventions
- **Co-location preferred**: Place `*.test.js` next to the code under test, or in a `__tests__` folder when grouping is clearer (keep consistent with existing `app/src/components/testing/__tests__`).
- **Naming**: `*.test.js` for unit/integration; `*.e2e.ts` for Playwright tests under `e2e/`.
- **Fixtures**: `tests/fixtures/` for shared data; component-level fixtures alongside component folders when tightly coupled.
- **MSW**: `tests/msw/handlers/*.ts` organized by bounded context; `tests/msw/server.ts` for setup.
- **Utilities**: `tests/utils/renderWithProviders.tsx` wrapping `RecoilRoot`, auth providers, and common context.

### Coverage Strategy
- **Thresholds**: Lines ≥ 80%, Branches ≥ 70%, Functions ≥ 75%. Incrementally increase thresholds per critical modules.
- **Enforcement**: `vitest --coverage` in CI; fail build on threshold miss.
- **Focus Areas**: Domain transforms (grades, unification), selection/filter logic (ratings, language, lecturer), event list/calendar transforms, and error handling.

### Data and Determinism
- **Network**: All network calls intercepted by MSW in tests.
- **Time**: Use fake timers or time injection for date-sensitive transforms.
- **Randomness**: Inject RNG seeds or mock UUIDs for stable IDs.
- **Snapshots**: Avoid broad UI snapshots; use targeted assertion or DOM subtrees for intentional visual contracts.

### Security and Error Handling Tests
- **Auth**: Token handling, header injection, and unauthorized flows validated.
- **Input Validation**: Boundary tests for filters/forms (e.g., ECTS ranges, search terms, language selections).
- **Error Redaction**: Ensure user-facing errors don’t leak sensitive details; test `ErrorBoundary` and `ErrorToast` behaviors.
- **Dependencies**: Regular dependency checks in CI; scan reports surfaced.

### Accessibility (a11y)
- **Component-level**: Use `jest-axe` to run accessibility checks for key pages/components (CourseInfo, EventListContainer, StudyOverview).
- **E2E-level**: Use semantic locators; consider Playwright a11y snapshot on critical pages.

## Initial Test Backlog (High-Level)
1) Domain Unit Tests
   - `calculateGrades.js`: grade/weight invariants; invalid inputs.
   - `unifiedDataTransforms.js`: schema transforms; missing fields; edge cases.
   - `createSemesterMap.js`: term boundaries; sorting; duplicates.

2) Integration Tests (with MSW)
   - `axiosClient.js` + `auth/tokenService.js`: header injection; 401 handling.
   - `useUnifiedCourseData.js`: data fetch + transform + recoil selectors.
   - `useEventListDataManager.js`: event generation and filtering.

3) UI Component Tests
   - `EventListContainer.jsx`: renders events, filters, empty states, loading.
   - `CourseInfo.jsx`: displays course attributes; toggles; error states.
   - `StudyOverview.jsx`: summary metrics; program selection; loading states.

4) E2E (Playwright)
   - Login (MSAL stub or test tenant), course search/filter, add to study plan, open course info, view calendar/events.

5) Security & a11y
   - Negative tests for forms/filters; ensure protected pages enforce auth.
   - `jest-axe` checks on primary pages.

## ADR-01: Testing Stack Selection
- **Context**: Project uses Vite + Vitest + React Testing Library.
- **Decision**: Standardize on Vitest for unit/integration, add MSW for API mocking, `fast-check` for property-based tests, Playwright for E2E, and `jest-axe` for a11y checks.
- **Status**: Proposed (pending team validation of E2E tool and thresholds).
- **Consequences**: Improved reliability and developer experience; minor learning curve for MSW/Playwright; CI needs Playwright setup.

## Next Steps (Pending Validation)
1) Confirm E2E tool (Playwright vs Cypress) and browser targets.
2) Confirm coverage thresholds and critical-path journeys.
3) Add MSW/fast-check/jest-axe/Playwright dependencies and baseline scaffolding.
4) Implement initial unit tests for domain transforms, then integration tests for adapters/hooks, then E2E smoke.

---

This strategy is intentionally pragmatic: it builds on the existing Vitest/RTL setup, aligns tests to bounded contexts, and balances speed with confidence according to the BCS testing pyramid.

