# Architecture Review Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the structural debt identified in the 2026-11-03 architecture review, in five phases that each leave `dev` shippable: quick wins, data-layer consolidation, a normalized domain model, bundle and request hygiene, and configuration and structure. A sixth phase holds the strategic state-library decision, which produces its own plan.

**Architecture:** The app keeps React 18, Recoil and the existing folder layout. New code goes into three small pure modules (`src/domain/semester.js`, `src/domain/credits.js`, `src/domain/course.js`) that are applied once at the ingestion points (`updateAvailableCourses`, enrolment and study-plan loaders), so consumers stop re-deriving identity, credits and semester keys. Derived state (`filtered`) moves from the atom into a selector. Every outbound request goes through `apiClient`. Each phase is one branch and one PR to `dev`, with a full gate (lint, tests, build, bundle budget) before the next phase starts.

**Tech Stack:** React 18.3, Vite 6, Recoil 0.7.7, Vitest 4 + @testing-library/react 16 + MSW 2, ESLint 8, Tailwind 3.4.

**Spec:** `docs/architecture-review-2026-11-03.md` (finding ids C1 to C7, P1 to P4, E1 to E6 are referenced below).

## Global Constraints

- All commands run from `app/`: `cd app` first (CLAUDE.md). File paths below are relative to `/Users/marc/Documents/GithubRepos/BidditRepos/Biddit2/` unless they start with `src/`, which is `app/src/`.
- Run tests with an explicit timeout (CLAUDE.md): `npx vitest run --testTimeout=10000 <file>`. The full suite: `npx vitest run --testTimeout=10000`. There is no `timeout` binary on macOS.
- `npm run lint` must pass with **0 warnings** before every commit. `npm run build` must succeed at every phase gate.
- Conventional Commits. **No "Co-Authored-By: Claude" or any Claude Code mention in commit messages** (user preference; overrides any default attribution instruction).
- One branch per phase, cut from `dev`: `chore/arch-fix-phase-0`, `refactor/arch-fix-phase-1`, `refactor/arch-fix-phase-2`, `perf/arch-fix-phase-3`, `refactor/arch-fix-phase-4`, `refactor/arch-fix-phase-5`. Commit per task. **Do not push or merge without explicit user approval.** Use a git worktree per phase branch (superpowers:using-git-worktrees).
- Never call `api.shsg.ch` except through `apiClient` (`src/components/helpers/axiosClient.js`); after Task 0.2 this rule extends to `integration.unisg.ch`. The only permitted `fetch` calls are `degradedModeService.js` (status document) and `examScheduleAtom.js` (static exam plan).
- Do not change user-visible behaviour unless a task says so. Every refactor task ends with the full suite green, not just its own tests.
- Keep the existing `__tests__/` colocation and the MSW setup in `src/test/mocks/`. New tests follow the `renderHook` + `RecoilRoot` wrapper pattern in `src/components/helpers/__tests__/useUnifiedCourseData.patchSemester.test.jsx`.
- Update `CLAUDE.md` in the same commit whenever a task renames, adds or deletes a file that `CLAUDE.md` names.
- Do not merge any phase during a bidding window; that is a release decision outside this plan.

## Decisions required before Phase 2

The plan proceeds with the defaults below. Change them here before Phase 2 starts if they are wrong.

| Decision | Default used by this plan | Where it matters |
|---|---|---|
| Authoritative "current semester" rule | Calendar rule: FS = February to July (months 1 to 6), HS = August to January. The university API `isCurrent` flag is a fallback when the calendar term is not in the term list. | Task 2.1 replaces the two conflicting heuristics in `curriculumPlanAtom.js:104-106` and `:191-192` and `studyOverviewHelpers.js:14-17`. |
| Wishlist delete behaviour | Keep deleting under the legacy `course.id` as well as `courseNumber` until the backend confirms no legacy ids remain; run the two deletes in parallel. | Task 2.4. |
| Bundle budget | Main chunk under 700 kB uncompressed after lazy loading. | Task 3.1 CI check. |
| Main-chunk lazy boundaries | Tab panels and `Login` are lazy; the left column stays eager. | Task 3.1. |

## Review Focus

Input classes the spec implies but no existing test exercises. Each line names the task that adds the pinning test.

1. A term whose own catalog returns 500 and that has no reference semester must surface one error toast and an empty list, not a spinner forever. Task 1.1 (`useCourseInfoData` test "primary 500, no reference").
2. Two catalog requests for the same `cisId` in flight at once (course list and curriculum map opened during load) must produce one HTTP request. Task 1.2.
3. Toggling a wishlist course while the keyword filter hides it must keep the course in Calendar and Summary (the `myCoursesSelector` guarantee) after `filtered` becomes a selector. Task 1.3.
4. A date in June must map to the same semester everywhere (map status, projected semesters, startup term). Task 2.1 date table.
5. A course whose API object carries `credits: 0` (exercise group) must render "0 ECTS", not the 4 ECTS default or "?". Task 2.2 (`toEcts(0)` is `0`).

---

## Orchestration guide

How to run this plan with Opus 5.5 sub-agents.

**Roles.**

- *Implementer*: one fresh Opus 5.5 agent per task. Its brief is: this file's header, Global Constraints, the task text, and the Interfaces blocks of the tasks it consumes. Nothing else. It works in the phase worktree, runs the steps, commits, and reports the commit hash plus the test command output.
- *Reviewer*: one fresh Opus 5.5 agent per task, running `/ponytail-review` on the task's diff (user preference) followed by a correctness check against the task's test steps. It reports findings as a list; the implementer agent is resumed with the findings.
- *Orchestrator* (this session): dispatches, runs the phase gate, writes the phase summary, asks the user before any push.

**Dispatch brief template.**

```
You are implementing Task <N> of docs/superpowers/plans/2026-11-03-architecture-review-fix-plan.md
in the worktree at <path> on branch <branch>. Read the plan header, Global Constraints and
the task. Do only that task. Follow its steps in order; each step is one action. Run the
named test command after each test step and paste the result. Do not modify files outside
the task's Files list without saying why. Commit with the given message. Report: commit
hash, the final test command and its last 5 lines, anything you had to decide yourself.
```

**Phase gate (orchestrator, after the last task of a phase).**

```bash
cd app && npm run lint && npx vitest run --testTimeout=10000 && npm run build && node scripts/check-bundle-size.mjs
```
(the last command exists from Task 3.1 on). Then one whole-branch review by a fresh Opus 5.5 agent, then a PR to `dev` titled with the phase name, body listing the finding ids closed.

**Parallelism within a phase.** Tasks in the same row of the dependency table below can run as parallel implementers in separate worktrees off the phase branch, each on its own sub-branch, merged into the phase branch in the listed order. Tasks that touch the same file are serialized.

| Phase | Parallel groups (run left to right; items in one group may run concurrently) |
|---|---|
| 0 | {0.1, 0.4, 0.6} then {0.2} then {0.3} then {0.5} then {0.7} |
| 1 | {1.1} then {1.2, 1.4} then {1.3} then {1.5, 1.6} then {1.7, 1.8} |
| 2 | {2.1, 2.2} then {2.3} then {2.4} |
| 3 | {3.1, 3.2} |
| 4 | {4.1} then {4.2} |
| 5 | {5.1, 5.2, 5.3} then {5.4} |

**Definition of done for a task.** Its steps are checked, its named tests pass, `npm run lint` is clean, the full suite is green, the commit exists, the reviewer has no open finding.

---

## Phase 0: Quick wins (closes P1, C1, P2-A, C4, C2, C3-B, C6)

Branch `chore/arch-fix-phase-0`. Target: one working week of agent time, no behaviour change except fewer requests failing.

### Task 0.1: Hoist the virtualized row components out of render

**Files:**
- Modify: `src/components/leftCol/bottomRow/EventListContainer.jsx:77-236` (remove `useUnifiedCourseData()` and the dev-logging block), `:238-422` (move `Row`, `LoadingRow`, `NoCoursesRow` to module scope), `:425-436` (memoize `itemData`)
- Test: `src/components/leftCol/bottomRow/__tests__/rowIdentity.test.jsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `EventListContainer` with the same props (`termListObject`, `selectedSemesterShortName`). Internal only.

- [ ] **Step 1: Write the failing test**

Reuse the render setup from `__tests__/smartSearchList.test.jsx` (RecoilRoot with `initializeState` seeding `unifiedCourseDataState` with two courses in `HS25.available` and `HS25.filtered`, `authTokenState`, and the `termListObject` prop).

```jsx
it("keeps the same row DOM nodes when the search term changes", async () => {
  const { container } = renderList();
  const before = await screen.findAllByTestId("course-list-row");
  act(() => {
    setSelectionOptions((prev) => ({ ...prev, searchTerm: "" })); // same filter, new object
  });
  const after = await screen.findAllByTestId("course-list-row");
  expect(after[0]).toBe(before[0]);
});
```

`setSelectionOptions` comes from a small harness component rendered inside the same `RecoilRoot` that exposes `useSetRecoilState(selectionOptionsState)` through a ref.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --testTimeout=10000 src/components/leftCol/bottomRow/__tests__/rowIdentity.test.jsx`
Expected: FAIL, `after[0]` is a different node than `before[0]`.

- [ ] **Step 3: Move `Row`, `LoadingRow`, `NoCoursesRow` to module scope**

`Row` already receives everything through `data`; keep `Row.propTypes`. Wrap `Row` in `React.memo`. Build `itemData` with `useMemo` keyed on `[displayedCourses, selectedSemesterShortName, selectedSemester, selectedCourseIds, openCourseDetails, setIsLeftViewVisibleState, addOrRemoveCourse, examPlan, plannedExams, myCourses]`. Delete the `useUnifiedCourseData()` call, `lastLogSnapshotRef`, `buildSemesterSummary`, `shallowSummary`, `logAtomSummary`, the two logging effects and the `window.__BIDDIT_DEBUG` hook (lines 87 and 134 to 226). Remove the two `eslint-disable` directives that go with them.

- [ ] **Step 4: Run the new test and the existing list tests**

Run: `npx vitest run --testTimeout=10000 src/components/leftCol/bottomRow`
Expected: PASS (rowIdentity, smartSearchList, examConflictRow, LockOpen).

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add src/components/leftCol/bottomRow
git commit -m "perf(course-list): hoist row components out of render and drop whole-atom subscription"
```

### Task 0.2: Route every university-API call through `apiClient`

**Files:**
- Create: `src/components/helpers/apiEndpoints.js`
- Modify: `src/components/helpers/useCourseInfoData.js:23,54-65`, `src/components/helpers/useEnrolledCoursesData.js:23,61-71`, `src/components/helpers/useTermSelection.js:3,133-143,208-218`, `src/components/helpers/useCurriculumMapCourseLoader.js:18,25-33,79-82`, `src/components/helpers/useUnifiedCourseLoader.js:116-131`
- Modify: `app/.eslintrc.cjs` (add `no-restricted-imports` for `axios`, with an override allowing it in `src/components/helpers/axiosClient.js`)
- Test: `src/components/helpers/__tests__/universityApiViaClient.test.jsx`

**Interfaces:**
- Produces, in `apiEndpoints.js`:
  ```js
  export const UNISG_API = "https://integration.unisg.ch";
  export const SHSG_API = "https://api.shsg.ch";
  export const catalogUrl = (cisId) => `${UNISG_API}/EventApi/CourseInformationSheets/myLatestPublishedPossiblebyTerm/${cisId}`;
  export const myCoursesUrl = (termId) => `${UNISG_API}/EventApi/MyCourses/byTerm/${termId}`;
  export const termsUrl = () => `${UNISG_API}/EventApi/CisTermAndPhaseInformations`;
  ```
  Later tasks (1.2, 4.1) build on these names.

- [ ] **Step 1: Write the failing test**

One `describe` per hook. Each test spies on the client and asserts the call went through it:

```jsx
const getSpy = vi.spyOn(apiClient, "get");
renderHook(() => useEnrolledCoursesData({ authToken: "t", selectedSemester }), { wrapper });
await waitFor(() => expect(getSpy).toHaveBeenCalledWith(myCoursesUrl("term-1"), "t", expect.anything()));
```

Cover `useEnrolledCoursesData`, `useCourseInfoData` (asserts `catalogUrl("cis-1")`), `useTermSelection` (asserts `termsUrl()`; seed `cisIdList` null and `authTokenState`), `useCurriculumMapCourseLoader` (seed `termListState` with one term and pass `["HS25"]`), `useUnifiedCourseLoader` (seed a semester with `selectedIds` and empty `available`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --testTimeout=10000 src/components/helpers/__tests__/universityApiViaClient.test.jsx`
Expected: FAIL, `getSpy` not called (raw axios/fetch bypass it).

- [ ] **Step 3: Create `apiEndpoints.js` and replace the five call sites**

Each becomes `apiClient.get(url, authToken, { headers: { "X-RequestedLanguage": "EN" } })` (the client already sets `X-ApplicationId` and `API-Version`). `useTermSelection.js:133` keeps `"DE"` for the term list (existing behaviour). `useUnifiedCourseLoader.js:116` loses its `response.ok` check (`apiClient` throws on non-2xx); keep the catch but log with `console.warn` in DEV only. Delete the `import axios` lines.

- [ ] **Step 4: Add the lint rule**

```js
"no-restricted-imports": ["error", { paths: [{ name: "axios", message: "Use apiClient from helpers/axiosClient.js" }] }],
```
plus an `overrides` entry for `files: ["src/components/helpers/axiosClient.js"]` turning it off.

- [ ] **Step 5: Run the new test, the resilience suite and lint**

Run: `npx vitest run --testTimeout=10000 src/components/helpers/__tests__/universityApiViaClient.test.jsx src/test/resilience && npm run lint`
Expected: PASS, 0 lint problems.

- [ ] **Step 6: Commit**

```bash
git add src/components/helpers .eslintrc.cjs
git commit -m "fix(http): route university API calls through apiClient and forbid raw axios"
```

### Task 0.3: Setter-only writers hook with stable identities

**Files:**
- Create: `src/components/helpers/useUnifiedCourseDataWriters.js`
- Modify: `src/components/helpers/useUnifiedCourseData.js` (becomes reader + writers composition; delete `logUnifiedCourseDataSummary`, `logUnifiedDataOverview`, `logReferenceSemesterChange`, `validateReferenceInvariant`, `ENABLE_REFERENCE_SEM_INVARIANTS`, the seven `// Alias for consistency` exports at `:780-794`)
- Modify (switch to writers hook): `useCourseInfoData.js`, `useStudyPlanDataSimplified.js`, `useCourseRatingsData.js`, `useEnrolledCoursesData.js`, `useOpenCourseDetails.js`, `useCurriculumMapCourseLoader.js`, `useUnifiedCourseLoader.js`, `useCourseSelection.js`
- Test: `src/components/helpers/__tests__/useUnifiedCourseDataWriters.test.jsx`

**Interfaces:**
- Produces: `useUnifiedCourseDataWriters()` returning `{ initializeSemester, patchSemester, updateSemesterMetadata, updateEnrolledCourses, updateAvailableCourses, updateSelectedCourses, addSelectedCourse, removeSelectedCourse, updateStudyPlan, updateCourseRatings, updateCourseRatingsForAllSemesters, updateFilteredCourses, updateFilteredCoursesForAllSemesters, updateSelectedCourseInfo, clearSelectedCourseInfo }`, every member wrapped in `useCallback` with `[setCourseData]` (plus `[setInitializedSemesters]` where used). Signatures unchanged from today.
- `useUnifiedCourseData()` keeps returning `courseData`, `initializedSemesters`, `getSemesterData`, `needsRefresh` and spreads the writers, so existing callers compile. The `updateFilteredCourses` guard that read `courseData` (`:575-577`) moves inside the functional `setCourseData` update.

- [ ] **Step 1: Write the failing tests**

```jsx
it("returns the same function identities across renders", () => {
  const { result, rerender } = renderHook(() => useUnifiedCourseDataWriters(), { wrapper });
  const first = result.current.updateSelectedCourses;
  rerender();
  expect(result.current.updateSelectedCourses).toBe(first);
});

it("does not re-render its host when the atom changes", () => {
  let renders = 0;
  const { result } = renderHook(() => { renders++; return useUnifiedCourseDataWriters(); }, { wrapper });
  act(() => result.current.updateSelectedCourses("HS25", ["7,035,1.00"]));
  expect(renders).toBe(1);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run --testTimeout=10000 src/components/helpers/__tests__/useUnifiedCourseDataWriters.test.jsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `useUnifiedCourseDataWriters` and recompose `useUnifiedCourseData`**

Use `useSetRecoilState(unifiedCourseDataState)` and `useSetRecoilState(initializedSemestersState)`. Move the module-level helpers (`DEFAULT_SEMESTER_STRUCTURE`, `createSemesterStructure`, `SEMESTER_METADATA_KEYS`, `mergeSemester`, `computeExpectedReference`) to the writers file and re-export the ones `useUnifiedCourseData.js` still needs.

- [ ] **Step 4: Switch the eight setter-only hosts to the writers hook**

Each import changes from `useUnifiedCourseData` to `useUnifiedCourseDataWriters`; destructuring is unchanged.

- [ ] **Step 5: Run the full suite and lint**

Run: `npx vitest run --testTimeout=10000 && npm run lint`
Expected: all 86+ files PASS, 0 lint problems.

- [ ] **Step 6: Commit**

```bash
git add src/components/helpers
git commit -m "perf(state): split unified course data into stable setter-only writers"
```

### Task 0.4: Make `CLAUDE.md` and `README.md` match `dev`, and check paths in CI

**Files:**
- Modify: `CLAUDE.md` (lines 215, 279, 294 and the "Helper Hook Pattern" and "Testing" sections), `README.md` ("Testing (COMING SOON)" section)
- Create: `app/scripts/check-doc-paths.mjs`
- Modify: `.github/workflows/ci.yml` (add `node scripts/check-doc-paths.mjs` after lint)

- [ ] **Step 1: Write the checker**

`check-doc-paths.mjs` reads `../CLAUDE.md`, extracts every backticked token that contains `/` and ends in `.js`, `.jsx`, `.md`, `.json` or `/`, resolves it against `app/src/`, `app/`, and the repo root, prints each missing path and exits 1 if any is missing. Run it: it must list at least `rightCol/transcript/`, `helpers/transcript/buildTranscriptModel.js`, `helpers/useGradesHidden.js`, `helpers/buildAcademicPrograms.js`, `useStudyPlanData.js`, `src/test/e2e/`, `src/test/migration/`.

- [ ] **Step 2: Fix the documents**

In `CLAUDE.md`: describe `Transcript.jsx` as it is on `dev` (uses `legacyAcademicDataSelector`, `GradeTranscript`) and add one line "A transcript rebuild on a pure model layer lives on `feature/transcript-overhaul` and is not merged." Replace the `buildAcademicPrograms.js` sentence with the current state (two hooks share the transform in `academicDataTransformers.js`; Task 0.5 adds the module and the sentence can be restored then). Remove `useStudyPlanData.js`. Replace the Suites line with `colocated __tests__/ folders plus src/test/resilience/`. Remove "ADR 0005" references or point to the review document. In `README.md` replace the "COMING SOON" section with the real commands (`npm test`, `npm run coverage`, `npm run lint`).

- [ ] **Step 3: Verify**

Run: `node scripts/check-doc-paths.mjs`
Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add ../CLAUDE.md ../README.md scripts/check-doc-paths.mjs ../.github/workflows/ci.yml
git commit -m "docs: align CLAUDE.md and README with dev and check documented paths in CI"
```

### Task 0.5: One academic-data bootstrap path

**Files:**
- Create: `src/components/helpers/buildAcademicPrograms.js`
- Modify: `src/components/helpers/useScorecardFetching.js:124-186`, `src/components/helpers/useInitializeScorecards.js` (reduce to a wrapper), `src/components/rightCol/Transcript.jsx:335-346` (render-time call becomes an effect)
- Test: `src/components/helpers/__tests__/buildAcademicPrograms.test.js`, `src/components/helpers/__tests__/scorecardBootstrapOnce.test.jsx`

**Interfaces:**
- Produces: `buildAcademicPrograms({ rawScorecards, mainStudyLookup, unifiedCourseData }) -> { programs, currentProgram }` where `programs` has exactly the per-programme shape built today at `useScorecardFetching.js:145-174` and `currentProgram` is the `findMainProgram` result.
- `useInitializeScoreCards(handleError)` keeps its signature but delegates to `useScorecardFetching().fetchAll`.

- [ ] **Step 1: Write the failing unit test**

Use `src/components/testing/mockData/Scorecard_BIA.json` as `rawScorecards["Bachelor in Information Systems"]`, an empty `unifiedCourseData` (`{ semesters: {} }`) and a `mainStudyLookup` marking that programme main.

```js
expect(result.currentProgram).toBe("Bachelor in Information Systems");
expect(result.programs[result.currentProgram].metadata.isMainStudy).toBe(true);
expect(result.programs[result.currentProgram].metadata.programType).toBe("bachelor");
expect(result.programs[result.currentProgram].transcript.processedTranscript.completedCourses.length).toBeGreaterThan(0);
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run --testTimeout=10000 src/components/helpers/__tests__/buildAcademicPrograms.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the module and call it from `fetchAll`**

Lift lines 126 to 175 of `useScorecardFetching.js` into the function unchanged. `fetchAll` calls it and keeps the `setUnifiedAcademicData` and `setScorecardState` writes.

- [ ] **Step 4: Write the failing "bootstrap once" test**

Mock `../../recoil/ApiScorecardDetails` and `../../recoil/ApiCurrentEnrollments` with `vi.mock` returning one enrolment and one scorecard. Render a hook that calls both `useInitializeScoreCards(vi.fn())` and `useScorecardFetching()` and invokes `fetchAll("t")` once in an effect, with `authTokenState` and `currentEnrollmentsState` seeded.

```js
await waitFor(() => expect(fetchScoreCardDetails).toHaveBeenCalledTimes(1));
```

- [ ] **Step 5: Run to verify failure**

Expected: FAIL, called 2 times.

- [ ] **Step 6: Reduce `useInitializeScoreCards` to a wrapper and fix `Transcript`**

```js
export const useInitializeScoreCards = (handleError) => {
  const authToken = useRecoilValue(authTokenState);
  const { fetchAll, isLoaded, loading } = useScorecardFetching();
  useEffect(() => {
    if (!authToken || isLoaded || loading) return;
    fetchAll(authToken).catch(handleError);
  }, [authToken, isLoaded, loading, fetchAll, handleError]);
};
```
`fetchAll` already dedupes through `scorecardState.loading`. In `Transcript.jsx` delete lines 335 to 346 (`handleFetchIfNeeded` and its render-time call); `useInitializeScoreCards` at line 59 now covers it.

- [ ] **Step 7: Run the suite and lint, then commit**

Run: `npx vitest run --testTimeout=10000 && npm run lint`
Expected: PASS.

```bash
git add src/components/helpers src/components/rightCol/Transcript.jsx ../CLAUDE.md
git commit -m "refactor(academic-data): single scorecard bootstrap through buildAcademicPrograms"
```
(`CLAUDE.md`: restore the `buildAcademicPrograms.js` sentence.)

### Task 0.6: Delete dead modules, dead writes and unused dependencies

**Files:**
- Delete: `src/components/helpers/unifiedDataTransforms.js`, `src/components/recoil/referenceSemesterAtom.js`, `src/components/recoil/ApiScorecardEnrollments.jsx`, `src/components/helpers/demoTestFunction.js`, `src/components/helpers/createSemesterMap.js`, `src/components/recoil/localSelectedCoursesAtom.js`, `src/components/testing/__tests__/demo.test.js` (if it only imports `demoTestFunction`)
- Modify: `src/components/helpers/useCourseSelection.js:3,44,98-124` (remove the `localSelectedCoursesState` write and the `index` parameter), `src/components/helpers/useUnifiedSemesterState.js` (delete `setFutureSemesterStatus`, `initializeSemester`, `updateSemesterCourses`; fix `setSelectedSemester` to write `enrolledIds`/`selectedIds` defaults instead of `enrolled`/`selected`), `src/components/testing/useRefreshMockData.jsx` (drop the commented `scorecardEnrollmentsAtom` import), `app/package.json` (remove `bootstrap`, `react-bootstrap`, `@tailwindcss/line-clamp`), `app/index.html:1-4` (correct the `</html>` placement)
- Test: `src/components/helpers/__tests__/useUnifiedSemesterState.test.jsx`

- [ ] **Step 1: Write the failing test for the schema fix**

```jsx
it("setSelectedSemester seeds a new semester with the unified schema keys", () => {
  act(() => result.current.api.setSelectedSemester("HS27", termIdList, "HS25"));
  const sem = result.current.state.semesters.HS27;
  expect(sem).toHaveProperty("enrolledIds");
  expect(sem).toHaveProperty("selectedIds");
  expect(sem).not.toHaveProperty("enrolled");
  expect(sem).not.toHaveProperty("selected");
  expect(sem.isFutureSemester).toBe(true);
  expect(sem.referenceSemester).toBe("HS26");
});
```
(`termIdList` contains `HS25`, `HS26`, `HS27`.)

- [ ] **Step 2: Run to verify failure, then implement**

Run: `npx vitest run --testTimeout=10000 src/components/helpers/__tests__/useUnifiedSemesterState.test.jsx`
Expected: FAIL on `not.toHaveProperty("enrolled")`. Make the edits listed in Files. For `package.json`, run `npm uninstall bootstrap react-bootstrap @tailwindcss/line-clamp`.

- [ ] **Step 3: Full suite, lint, build**

Run: `npx vitest run --testTimeout=10000 && npm run lint && npm run build`
Expected: PASS; build succeeds (confirms no import of the removed packages).

- [ ] **Step 4: Commit**

```bash
git add -A src package.json package-lock.json index.html
git commit -m "chore: remove dead modules, dead atom writes and unused dependencies"
```

### Task 0.7: DEV-gated logger and redacted error details

**Files:**
- Create: `src/components/helpers/log.js`
- Modify: `app/.eslintrc.cjs` (`"no-console": ["error", { allow: ["warn", "error"] }]`, with overrides turning it off for `src/components/helpers/log.js` and `scripts/**`)
- Modify: every file that currently calls `console.log`, `console.info`, `console.debug`, `console.group`, `console.groupCollapsed`, `console.groupEnd` (lint will list them; the heavy ones are `studyOverview/utils/dataAdapter.js`, `usePlanManager.js`, `SimilarCourses.jsx`, `useStudyPlanDataSimplified.js`, `useTermSelection.js`, `useUnifiedAcademicData.js`, `useCourseSelection.js`, `curriculumPlansApi.js`, `coursesTakenForRatings.js`, `api.js`, `Transcript.jsx`, `axiosClient.js:281`)
- Modify: `src/components/errorHandling/ErrorHandlingService.jsx:130-146`
- Test: `src/components/helpers/__tests__/log.test.js`, extend `src/components/errorHandling/__tests__/ErrorHandlingService.test.jsx`

**Interfaces:**
- Produces: `log.debug(...args)`, `log.info(...args)` (no-ops unless `import.meta.env.DEV`), `log.warn`, `log.error` (always forwarded to `console`).

- [ ] **Step 1: Write the failing tests**

```js
it("debug is silent outside DEV", () => {
  vi.stubEnv("DEV", false);
  const spy = vi.spyOn(console, "log").mockImplementation(() => {});
  log.debug("x");
  expect(spy).not.toHaveBeenCalled();
});
it("error always forwards", () => { /* console.error spy called once */ });
```
In the error-handling test: `handleError` with `error.config.data = { grade: 5.5 }` outside DEV logs an `errorDetails` whose `data` is `"[redacted]"`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run --testTimeout=10000 src/components/helpers/__tests__/log.test.js src/components/errorHandling`
Expected: FAIL.

- [ ] **Step 3: Implement `log.js`, redact, then replace calls until lint is clean**

In `ErrorHandlingService.jsx`, set `data` and `params` in `errorDetails` to `"[redacted]"` when `!import.meta.env.DEV`. Replace `console.log/info/debug` with `log.debug`, `console.group*` with nothing (delete the grouping) or `log.debug`. Keep `console.warn`/`console.error` where they are intentional.

- [ ] **Step 4: Lint, full suite, commit**

Run: `npm run lint && npx vitest run --testTimeout=10000`
Expected: 0 problems, PASS.

```bash
git add -A src .eslintrc.cjs
git commit -m "chore(logging): DEV-gated logger, no-console lint rule, redacted request bodies"
```

**Phase 0 gate:** run the gate command, whole-branch review, PR "Phase 0: quick wins from the 2026-11-03 architecture review (C1, C2, C3-B, C4, C6, P1, P2-A)".

---

## Phase 1: Data-layer consolidation (closes P2-B, P2-C, P3, C3-A, E6 part)

Branch `refactor/arch-fix-phase-1`, cut from `dev` after Phase 0 merges; if Phase 0 is still unmerged, continue on `architecture-fixes-nov26` on top of debef66 and the PR carries both phases.

Tasks 1.7 and 1.8 absorb three defects found by the Phase 0 browser verification (all pre-existing on `dev`): a double toast on scorecard failure, a Transcript that never leaves its loading state after a scorecard failure, and an enrolment effect without a cancel guard.

### Task 1.1: Safety-net tests for the startup and catalog hooks

**Files:**
- Test: `src/components/helpers/__tests__/useCourseInfoData.test.jsx`, `src/components/helpers/__tests__/useTermSelection.test.jsx`
- Modify (fixtures only): `src/test/mocks/handlers.js` if the catalog handler cannot already return a configurable course count

**Interfaces:**
- Consumes: `catalogUrl`, `myCoursesUrl`, `termsUrl` from Task 0.2; `useUnifiedCourseData` reader for assertions.

- [ ] **Step 1: Write the `useCourseInfoData` tests** (MSW `server.use` per test)

Render with `selectedSemester = { cisId: "cis-26", shortName: "HS26", referenceCisId: "cis-25", referenceSemester: "HS25" }` and read `unifiedCourseDataState.semesters.HS26`.

1. "full catalog": handler returns 12 parents → `available.length === 12`, `usingReferenceData === false`.
2. "sparse term previews the reference": primary returns 3, reference (`cis-25`) returns 12 → `available.length === 12`, `usingReferenceData === true`, `referenceSemester === "HS25"`.
3. "primary 500 with reference": primary 500 → reference data stored, `errorHandlingService.handleError` not called (spy).
4. "primary 500, no reference" (`referenceCisId` undefined): `handleError` called once, `isCourseDataLoading` ends `false`, `available` is `[]`.

- [ ] **Step 2: Write the `useTermSelection` tests**

`vi.setSystemTime(new Date("2026-10-15"))`. MSW `termsUrl()` returns three terms `FS26`, `HS26`, `FS27` (with `timeSegmentId`, `id`, `isCurrent` on `HS26`), `myCoursesUrl("*")` returns `[]`.

1. `termListObject.map(t => t.shortName)` equals `["FS26", "HS26", "FS27", "HS27", "FS28"]` (two projected semesters appended).
2. The projected `HS27` has `isProjected: true`, `referenceSemester: "HS26"`, `referenceCisId` equal to HS26's `cisId`.
3. `unifiedCourseDataState.selectedSemester === "HS26"` and `latestValidTerm === "HS26"`.
4. "calendar term missing from API falls back to isCurrent": terms `FS25`, `HS25` only → `selectedSemester === "HS25"`.

- [ ] **Step 3: Run and make green without changing hook behaviour**

Run: `npx vitest run --testTimeout=10000 src/components/helpers/__tests__/useCourseInfoData.test.jsx src/components/helpers/__tests__/useTermSelection.test.jsx`
Expected: PASS. If a test fails for a reason that is a real bug, stop and report it rather than changing the assertion.

- [ ] **Step 4: Commit**

```bash
git add src/components/helpers/__tests__ src/test/mocks
git commit -m "test(helpers): pin startup term selection and catalog fallback behaviour"
```

### Task 1.2: One catalog loader with in-flight deduplication

**Files:**
- Create: `src/components/helpers/catalogLoader.js`
- Modify: `src/components/helpers/useCourseInfoData.js` (body of `fetchCourseData` becomes one call), `src/components/helpers/useCurriculumMapCourseLoader.js:65-132`, `src/components/helpers/useUnifiedCourseLoader.js:98-135`
- Test: `src/components/helpers/__tests__/catalogLoader.test.js`

**Interfaces:**
- Produces:
  ```js
  export const REFERENCE_FALLBACK_MIN_COURSES = 10; // moved here from useCourseInfoData.js
  export async function loadCatalogForTerm({ term, authToken })
    // term: { cisId, shortName, referenceCisId?, referenceSemester? }
    // -> { courses: Array, usingReferenceData: boolean, referenceSemester: string|null, source: "primary"|"reference"|"none", error?: Error }
  export const _resetCatalogLoaderForTests = () => void
  ```
  Callers pass the result to `updateAvailableCourses(term.shortName, courses, { usingReferenceData, referenceSemester })`. A module-level `Map<cisId, Promise>` dedupes concurrent requests; entries are removed when settled.

- [ ] **Step 1: Write the failing tests**

```js
it("issues one request for two concurrent loads of the same cisId", async () => {
  let hits = 0;
  server.use(http.get(catalogUrl("cis-1"), () => { hits++; return HttpResponse.json(twelveCourses); }));
  await Promise.all([loadCatalogForTerm({ term, authToken: "t" }), loadCatalogForTerm({ term, authToken: "t" })]);
  expect(hits).toBe(1);
});
it("falls back to the reference term when the primary is sparse", ...); // source === "reference"
it("returns source none with the error when primary fails and there is no reference", ...);
```

- [ ] **Step 2: Run to verify failure, implement, re-run**

Run: `npx vitest run --testTimeout=10000 src/components/helpers/__tests__/catalogLoader.test.js`
Expected: FAIL then PASS.

- [ ] **Step 3: Replace the three copies**

`useCourseInfoData`: `const result = await loadCatalogForTerm({ term: selectedSemester, authToken }); if (result.source === "none") errorHandlingService.handleError(result.error); else updateAvailableCourses(...)`. `useCurriculumMapCourseLoader` keeps `attemptedRef`; `useUnifiedCourseLoader` keeps `loadedSemesters`. Delete the duplicated fallback code in both.

- [ ] **Step 4: Run Task 1.1 tests, the resilience suite, full suite, lint; commit**

Run: `npx vitest run --testTimeout=10000 && npm run lint`

```bash
git add src/components/helpers
git commit -m "refactor(catalog): single loader with in-flight dedupe and one reference-fallback rule"
```

### Task 1.3: `filtered` becomes a selector family

**Files:**
- Modify: `src/components/recoil/unifiedCourseDataSelectors.js` (add `filteredCoursesSelector`; `semesterCoursesSelector` case `"filtered"` delegates to it), `src/components/helpers/useUnifiedCourseDataWriters.js` (delete `updateFilteredCourses`, `updateFilteredCoursesForAllSemesters`, the `filtered` patches in `addSelectedCourse`/`removeSelectedCourse`, and `filtered` from `DEFAULT_SEMESTER_STRUCTURE`), `src/components/helpers/useEventListDataManager.js:94-141` (delete both filter effects), every reader of `.filtered` or `type: "filtered"` (grep; expected: `EventListContainer.jsx`, `SemesterSummary.jsx`, `Heatmap.jsx`, tests)
- Test: `src/components/recoil/__tests__/filteredCoursesSelector.test.js`

**Interfaces:**
- Produces: `filteredCoursesSelector = selectorFamily({ key: "filteredCoursesSelector", get: (semesterShortName) => ({ get }) => Course[] })` reading `semesterCourseDataSelector(semesterShortName)` and `selectionOptionsState`, returning `available` with `avgRating` attached (via `lookupCourseRating`), `applyFilterCriteria` applied, `enrolled`/`selected` flags attached from the id lists, sorted with `sortCoursesByStatus`. Identical output to today's `updateFilteredCourses`.

- [ ] **Step 1: Write the failing selector test**

Seed `unifiedCourseDataState` with three courses (one enrolled, one selected, one neither), `ratings`, and `selectionOptionsState = { searchTerm: "", classifications: [], ects: [], ratings: [], courseLanguage: [], lecturer: [] }`.

```js
expect(result.map(c => c.courseNumber)).toEqual(["enrolled-1", "selected-1", "other-1"]);
expect(result[0].enrolled).toBe(true); expect(result[1].selected).toBe(true);
expect(result[2].avgRating).toBe(4.2);
// with searchTerm "other": length 1
```

- [ ] **Step 2: Run to verify failure, implement the selector, re-run**

- [ ] **Step 3: Remove the stored `filtered` and its writers; switch readers**

`EventListContainer` reads `filteredCoursesSelector(selectedSemesterShortName)`. The two effects in `useEventListDataManager` go; the hook keeps the loading aggregation. The resilience test `src/test/resilience/degradedMode.test.jsx` and `smartSearchList.test.jsx` seed or assert `filtered`; update them to seed `available` plus ids and assert through the selector.

- [ ] **Step 4: Verify the Review Focus item 3**

Add to `calendarEntriesSelector.test.js`: with `searchTerm: "zzz"` (hides everything), `calendarEntriesSelector` still returns entries for the selected course. Expected: PASS without changes (it reads `myCoursesSelector`), which proves the guarantee survives.

- [ ] **Step 5: Full suite, lint, commit**

```bash
git add -A src
git commit -m "refactor(state): derive the filtered course list in a selector instead of storing it"
```

### Task 1.4: Load study plans once per session

**Files:**
- Create: `src/components/recoil/studyPlanLoadState.js` (`atom({ key: "studyPlanLoadState", default: { loaded: false, version: 0 } })`)
- Modify: `src/components/helpers/useStudyPlanDataSimplified.js` (effect depends on `[authToken, isDegradedMode, version]`, not `selectedSemester.id`; sets `loaded: true` after applying all semesters), `src/components/helpers/useCourseSelection.js` (after `saveCourse`/`deleteCourse` settle, bump `version` only on failure so a failed write re-syncs from the server)
- Test: `src/components/helpers/__tests__/useStudyPlanDataSimplified.test.jsx`

**Interfaces:**
- Produces: `studyPlanLoadState`, and `invalidateStudyPlan()` returned by a tiny hook `useInvalidateStudyPlan()` in the same file (bumps `version`).

- [ ] **Step 1: Write the failing test**

```js
it("fetches /study-plans once across two semester switches", async () => {
  let hits = 0; server.use(http.get(`${SHSG_API}/study-plans`, () => { hits++; return HttpResponse.json({ HS25: ["7,035,1.00"], FS26: [] }); }));
  const { rerender } = renderHook(({ sem }) => useStudyPlanDataSimplified({ authToken: "t", selectedSemester: sem }), { wrapper, initialProps: { sem: HS25 } });
  await waitFor(() => expect(hits).toBe(1));
  rerender({ sem: FS26 }); rerender({ sem: HS25 });
  await new Promise(r => setTimeout(r, 50));
  expect(hits).toBe(1);
});
```

- [ ] **Step 2: Run to verify failure (hits is 3), implement, re-run**

- [ ] **Step 3: Full suite incl. resilience (degraded-mode recovery must still refetch), lint, commit**

```bash
git add src/components/helpers src/components/recoil
git commit -m "perf(wishlist): fetch study plans once per session and invalidate on failed writes"
```

### Task 1.5: Ratings stored once, not per semester

**Files:**
- Modify: `src/components/recoil/unifiedCourseDataAtom.js` (add top-level `ratings: {}`), `src/components/recoil/unifiedCourseDataSelectors.js` (`semesterRatingsSelector` returns the top-level map; `smartSearchResultsSelector` and `filteredCoursesSelector` read it), `src/components/helpers/useUnifiedCourseDataWriters.js` (`updateCourseRatings(ratings)` writes top-level; delete `updateCourseRatingsForAllSemesters` and the per-semester `ratings` key), `src/components/helpers/useCourseRatingsData.js:79-85`
- Test: extend `src/components/recoil/__tests__/filteredCoursesSelector.test.js`

- [ ] **Step 1: Write the failing test**

```js
it("updating ratings does not replace semester objects", () => {
  const before = result.current.state.semesters.HS25;
  act(() => result.current.api.updateCourseRatings([{ _id: "7,035,1.00", avgRating: 4.5 }]));
  expect(result.current.state.semesters.HS25).toBe(before);
  expect(result.current.filtered[0].avgRating).toBe(4.5);
});
```

- [ ] **Step 2: Run, implement, re-run; full suite; commit**

```bash
git commit -am "perf(state): store course ratings once at top level"
```

### Task 1.6: Retire `localSelectedCoursesSemKeyState`

**Files:**
- Modify: `src/components/recoil/curriculumMapSelector.js:804,826-828,879-960` (wishlist pass reads `semesters[semKey].selectedIds` resolved against `available`, using `findCreditsInAnySemester` for credits as today), `src/components/recoil/unifiedAcademicDataSelectors.js:40-109` (`unifiedStudyPlanSelector` builds `localSelectedMaps` from `selectedIds`), `src/components/rightCol/CurriculumMap/CoursePicker.jsx:101`, `src/components/helpers/useCourseSelection.js` (delete the second legacy write and `minimalCourse`), delete `src/components/recoil/localSelectedCoursesSemKeyAtom.js`
- Test: `src/components/recoil/__tests__/curriculumMapSelector.test.js` (every `initializeState` that seeds the atom now seeds `unifiedCourseDataState.semesters[sem].selectedIds` plus `available`), `src/components/recoil/__tests__/curriculumPlanAtom.test.js` if it seeds the atom

**Interfaces:**
- The wishlist pass in `curriculumMapSelector` keeps emitting items with `source: "wishlist"` and the same fields (`id`, `courseId`, `name`, `credits`, `semester`, `categoryPath`, `status`, `classification`, `calendarEntry`).

- [ ] **Step 1: Add a failing test to `curriculumMapSelector.test.js`**

"a server-loaded wishlist course appears on the map after reload": seed only `selectedIds: ["7,035,1.00"]` and a matching `available` entry for `HS25`, no local-selected atom → the grid cell for its category contains an item with `source: "wishlist"`.

- [ ] **Step 2: Run to verify failure, implement the three reads, delete the atom and its write**

- [ ] **Step 3: Update the existing seeds in the test file, run the whole recoil test folder, full suite, lint; commit**

```bash
git add -A src
git commit -m "refactor(state): wishlist for map and study plan comes from unified selectedIds"
```

### Task 1.7: Remove the duplicate startup enrolment fetch and guard the enrolment effect

**Files:**
- Modify: `src/components/helpers/useTermSelection.js:202-238` (no `myCoursesUrl` request; `latestValidTerm = primaryTermShortName` directly), `src/components/helpers/useEnrolledCoursesData.js:48-95` (effect gets a cancel guard)
- Test: `src/components/helpers/__tests__/useTermSelection.test.jsx` (assert the handler for `myCoursesUrl` is hit 0 times), `src/components/helpers/__tests__/useEnrolledCoursesData.test.jsx` (new), `src/test/resilience/degradedMode.test.jsx` (already proves `enrolledIds` lands via `useEnrolledCoursesData`)

**Interfaces:**
- Consumes: `myCoursesUrl` from Task 0.2; `useUnifiedCourseDataWriters().updateEnrolledCourses` from Task 0.3.
- `useEnrolledCoursesData({ authToken, selectedSemester })` keeps its signature and return shape.

- [ ] **Step 1: Add the failing assertion to `useTermSelection.test.jsx`, run, implement, re-run**

- [ ] **Step 2: Write the failing cancel-guard test**

Browser verification on 2026-11-03 showed two enrolment requests and two toasts for one 404 in dev, because React StrictMode runs the effect twice and nothing ignores the first run's result.

```jsx
it("ignores the result of a superseded fetch", async () => {
  const seen = [];
  server.use(http.get(myCoursesUrl("term-1"), async () => { await delay(50); return HttpResponse.json([{ id: "old" }]); }),
             http.get(myCoursesUrl("term-2"), () => HttpResponse.json([{ id: "new" }])));
  const { rerender } = renderHook(({ sem }) => useEnrolledCoursesData({ authToken: "t", selectedSemester: sem }), { wrapper, initialProps: { sem: { id: "term-1", shortName: "HS25" } } });
  rerender({ sem: { id: "term-2", shortName: "FS26" } });
  await waitFor(() => expect(readSemester("FS26").enrolledIds).toEqual(["new"]));
  await new Promise((r) => setTimeout(r, 80));
  expect(readSemester("HS25").enrolledIds).toEqual([]);   // the stale response was dropped
});
it("reports a failed fetch once", async () => {
  server.use(http.get(myCoursesUrl("term-1"), () => new HttpResponse(null, { status: 404 })));
  const spy = vi.spyOn(errorHandlingService, "handleError").mockImplementation(() => {});
  renderHook(() => useEnrolledCoursesData({ authToken: "t", selectedSemester: { id: "term-1", shortName: "HS25" } }), { wrapper: StrictModeWrapper });
  await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
});
```
`StrictModeWrapper` wraps `RecoilRoot` in `React.StrictMode`.

- [ ] **Step 3: Run to verify failure, implement, re-run**

In the effect: `let cancelled = false;` before the async call, `if (cancelled) return;` before every state write and before `handleError`, and `return () => { cancelled = true; };`. Remove the `eslint-disable-next-line react-hooks/exhaustive-deps` and list the real dependencies (`authToken`, `selectedSemester?.id`, `selectedSemester?.shortName`, `updateUnifiedEnrolledCourses`).

Run: `npx vitest run --testTimeout=10000 src/components/helpers/__tests__/useEnrolledCoursesData.test.jsx src/components/helpers/__tests__/useTermSelection.test.jsx`
Expected: PASS.

- [ ] **Step 4: Full suite, lint, commit**

```bash
git add src/components/helpers
git commit -m "perf(startup): drop the duplicate enrolment request and guard the enrolment effect"
```

### Task 1.8: Scorecard failure surfaces once and the Transcript leaves its loading state

**Files:**
- Modify: `src/components/recoil/ApiScorecardDetails.jsx:23-36` (pass `suppressErrorToast: true`, delete the `catch` that calls `errorHandlingService.handleError`; the error propagates), `src/components/helpers/useScorecardFetching.js:80-143` (one `errorHandlingService.handleError` when `errors.length > 0`, with the first failing programme's error; the per-programme collection stays), `src/components/rightCol/Transcript.jsx:39,341-358` (`scorecardError` comes from `useScorecardFetching().error`, not `useState(false)`)
- Test: extend `src/components/helpers/__tests__/scorecardBootstrapOnce.test.jsx`; `src/components/rightCol/__tests__/Transcript.errorState.test.jsx` (new)

**Interfaces:**
- Consumes: `useScorecardFetching()` from Task 0.5 (`fetchAll`, `isLoaded`, `loading`, `error`), `suppressErrorToast` from the Phase 0 fix round.
- Produces: no new exports. `useScorecardFetching().error` is a string or `null`; it is the single source of the Transcript's error state.

Browser verification on 2026-11-03: a forced scorecard 500 showed two toasts per attempt (the `apiClient` interceptor plus `ApiScorecardDetails`'s own catch) and left the Transcript on "Loading transcript data..." indefinitely. The Phase 0 review also deferred the inverse gap: a failure of one programme out of several produced no toast at all. Both close here.

- [ ] **Step 1: Write the failing tests**

In `scorecardBootstrapOnce.test.jsx`, with the mocked `fetchScoreCardDetails` rejecting once for one programme:

```js
it("reports a scorecard failure exactly once", async () => {
  const spy = vi.spyOn(errorHandlingService, "handleError").mockImplementation(() => {});
  // render useScorecardFetching, call fetchAll("t"), two programmes, one rejects
  await waitFor(() => expect(result.current.error).toMatch(/BIA/));
  expect(spy).toHaveBeenCalledTimes(1);
});
```

In `Transcript.errorState.test.jsx`, seed `scorecardDataState` (the atom `useScorecardFetching` reads) with `{ loading: false, isLoaded: false, error: "BIA: 500" }` and the auth token, render `<Transcript />` inside `RecoilRoot`:

```js
expect(screen.getByText(/couldn.t load your scorecard data/i)).toBeInTheDocument();   // ScorecardErrorMessage copy
expect(screen.queryByText("Loading transcript data...")).toBeNull();
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run --testTimeout=10000 src/components/helpers/__tests__/scorecardBootstrapOnce.test.jsx src/components/rightCol/__tests__/Transcript.errorState.test.jsx`
Expected: FAIL (`handleError` called 2 times; the loading text is still rendered).

- [ ] **Step 3: Implement the three edits, re-run; full suite; lint; commit**

Keep `Transcript`'s per-mount retry from Phase 0 (`useInitializeScoreCards`), so a remount after an error still attempts once more.

```bash
git add src/components/recoil/ApiScorecardDetails.jsx src/components/helpers src/components/rightCol
git commit -m "fix(academic-data): one toast per scorecard failure and a visible Transcript error state"
```

**Phase 1 gate:** gate command, whole-branch review, PR "Phase 1: data-layer consolidation (P2-B/C, P3, C3-A)". Record in the PR body the request count on cold start before and after (Chrome network panel, filter `integration.unisg.ch`).

---

## Phase 2: Domain model (closes E1, prepares E2)

Branch `refactor/arch-fix-phase-2`.

### Task 2.1: `src/domain/semester.js`

**Files:**
- Create: `src/domain/semester.js`, `src/domain/__tests__/semester.test.js`
- Modify (replace local copies with imports, keep exported names where other files import them): `src/components/recoil/curriculumPlanAtom.js:99-276` (helpers become re-exports), `src/components/helpers/useUnifiedCourseDataWriters.js` (`computeExpectedReference`), `src/components/helpers/useUnifiedSemesterState.js:12-20`, `src/components/helpers/useTermSelection.js:51-63,86-93,316-319`, `src/components/recoil/curriculumMapSelector.js:22-24`, `src/components/helpers/useCurriculumMapCourseLoader.js:35`, `src/components/helpers/courseSelection.js`, `src/components/helpers/studyOverviewHelpers.js:14-22,60-100`, `src/components/helpers/transformScorecard.js:11-42`

**Interfaces:**
- Produces:
  ```js
  export const normalizeSemesterKey = (input) => string;        // "HS 25", "HS25 - Placeholder" -> "HS25"; "" for null/non-match
  export const parseSemesterKey = (key) => ({ season: "HS"|"FS", year: number, fullYear: number }) | null;
  export const compareSemesterKeys = (a, b) => number;         // chronological, FS before HS in a year
  export const sortSemesterKeys = (keys) => string[];
  export const nextSemesterKey = (key) => string;
  export const previousYearSameSeason = (key) => string | null;  // "HS26" -> "HS25"
  export const FS_MONTHS = [1, 2, 3, 4, 5, 6];                  // Feb..Jul, 0-based months (decision table)
  export const currentSemesterKey = (date = new Date()) => string;
  export const semesterStatus = (key, date = new Date()) => "completed"|"current"|"future";
  ```

- [ ] **Step 1: Write the failing tests** (table-driven)

```js
it.each([
  ["2026-01-15", "HS25"], ["2026-02-01", "FS26"], ["2026-06-15", "FS26"],
  ["2026-07-31", "FS26"], ["2026-08-01", "HS26"], ["2026-12-31", "HS26"],
])("currentSemesterKey(%s) is %s", (d, k) => expect(currentSemesterKey(new Date(d))).toBe(k));
expect(normalizeSemesterKey("HS 25 - Placeholder")).toBe("HS25");
expect(sortSemesterKeys(["HS26", "FS26", "HS25"])).toEqual(["HS25", "FS26", "HS26"]);
expect(previousYearSameSeason("FS26")).toBe("FS25");
```

- [ ] **Step 2: Run, implement, re-run**

- [ ] **Step 3: Replace the local copies**

`getCurrentSemesterInfo` in `curriculumPlanAtom.js` becomes a thin wrapper over `currentSemesterKey` and `nextSemesterKey`; delete the month logic at `:104-106` and `:191-192`. `studyOverviewHelpers.useCurrentSemester` returns `currentSemesterKey()` when it is in the term list, else the API `isCurrent` term (decision table).

- [ ] **Step 4: Full suite (expect `curriculumMapSelector.test.js` and `curriculumPlanAtom.test.js` to need `vi.setSystemTime` where they relied on real dates), lint; commit**

```bash
git add -A src
git commit -m "refactor(domain): one semester module replaces eight local copies and two conflicting calendar rules"
```

### Task 2.2: `src/domain/credits.js`

**Files:**
- Create: `src/domain/credits.js`, `src/domain/__tests__/credits.test.js`
- Modify (replace heuristics): `useCourseSelection.js:13-19`, `curriculumMapSelector.js:34-37` (`normalizeCourseCredits` becomes a re-export of `toEcts` with the same fallback parameter), `pages/Biddit2.jsx:27-31`, `unifiedAcademicDataSelectors.js:101`, `academicDataTransformers.js`, `SemesterSummary.jsx`, `SimilarCourses.jsx`, `CourseInfo.jsx:243`, `EventListContainer.jsx` (row ECTS cell), `leftCol/topRow/SelectEcts.jsx`

**Interfaces:**
- Produces:
  ```js
  export const toEcts = (raw, fallback = null) => number | fallback;  // null/undefined -> fallback; > 99 -> raw/100; else raw
  export const formatEcts = (ects) => string;                          // null -> "?", 3 -> "3", 4.5 -> "4.5"
  ```

- [ ] **Step 1: Failing tests**: `toEcts(300) === 3`, `toEcts(3) === 3`, `toEcts(0) === 0`, `toEcts(null) === null`, `toEcts(undefined, 4) === 4`, `formatEcts(null) === "?"`, `formatEcts(4.5) === "4.5"`.
- [ ] **Step 2: Run, implement, re-run**
- [ ] **Step 3: Replace the eleven sites.** `DragPreviewCard.formatCredits(credits, isNormalized)` becomes `formatEcts(toEcts(item.credits))` and the `isNormalized` flag disappears. `useCourseSelection.normalizeCredits` default of 4 for missing credits is preserved as `toEcts(credits, 4)`.
- [ ] **Step 4: Full suite, lint, commit** `refactor(domain): toEcts/formatEcts replace eleven credit heuristics`

### Task 2.3: `src/domain/course.js` applied at ingestion

**Files:**
- Create: `src/domain/course.js`, `src/domain/__tests__/course.test.js`
- Modify: `src/components/helpers/useUnifiedCourseDataWriters.js` (`updateAvailableCourses` maps flattened courses through `normalizeCourse` after `processCatalogSubEventECTS`; `updateEnrolledCourses` uses `courseKey`), `src/components/helpers/courseUtils.js` (`getCourseIdentifier` becomes a re-export of `courseKey`), `src/components/helpers/useCourseSelection.js:71-78` (`isCourseSelected = selectedCourseIds.includes(courseKey(course))`), `src/components/recoil/curriculumMapSelector.js:883-888` (`sameCourse`)

**Interfaces:**
- Produces:
  ```js
  export const courseKey = (course) => string | null;   // same priority as getCourseIdentifier today
  export const courseRootKey = (course) => string | null; // moved from courseUtils.getCourseRootKey
  export const sameCourse = (a, b) => boolean;           // courseKey equality, falling back to id/courseId cross-match
  export const normalizeCourse = (raw) => ({ ...raw, key: courseKey(raw), ects: toEcts(raw.credits), rootKey: courseRootKey(raw) });
  ```
  `normalizeCourse` is additive: it keeps every raw field (including `credits`) so existing consumers keep working, and adds `key`, `ects`, `rootKey`. Consumers migrate to `key` and `ects` opportunistically.

- [ ] **Step 1: Failing tests**: `courseKey({ courses: [{ courseNumber: "a" }], courseNumber: "b" }) === "a"`; `courseKey({ eventCourseNumber: "e", id: "i" }) === "e"`; `sameCourse({ id: "7,035,1.00" }, { courseNumber: "7,035,1.00" }) === true`; `normalizeCourse({ credits: 300 }).ects === 3` and `.credits === 300`.
- [ ] **Step 2: Run, implement, re-run**
- [ ] **Step 3: Apply at ingestion and simplify the three identity sites.** Extend `useUnifiedCourseData.availableCourses.test.jsx` with "every available course carries key and ects".
- [ ] **Step 4: Full suite, lint, commit** `refactor(domain): normalizeCourse at ingestion; courseKey/sameCourse replace ad-hoc identity checks`

### Task 2.4: Wishlist removal without the serial triple delete

**Files:**
- Modify: `src/components/helpers/useCourseSelection.js:174-201`
- Test: `src/components/helpers/__tests__/useCourseSelection.remove.test.jsx`

- [ ] **Step 1: Failing test**: with MSW counting DELETEs, removing a course whose `id === courseNumber` issues exactly 1 DELETE; one whose legacy `id` differs issues 2, in parallel (both requests observed before either resolves, use a deferred handler). Per the decision table, `courseId` is no longer tried unless it differs from both.
- [ ] **Step 2: Run, implement with `Promise.all`, re-run**
- [ ] **Step 3: Remove the local entry under every id that was deleted.** Phase 1 review: `removeSelectedCourse` removes by course number only, so a `selectedIds` entry stored under a legacy catalog id survived a successful server delete (and the `CoursePicker` exclusion list used the same lookup). After the deletes settle, remove both ids from `selectedIds`. Test: seed `selectedIds: ["evt-123"]` for a course whose `courseNumber` is `7,035,1.00` and `id` is `evt-123`; after removal `selectedIds` is `[]`.
- [ ] **Step 3b: No toast for the expected 404.** Phase 1 re-review: the speculative delete under the legacy id toasts once on its expected 404 (`useCourseSelection.js:107`), so a normal wishlist removal can show an error. Treat a 404 on the secondary id as success; toast only when every delete fails. Test: primary DELETE 200, legacy DELETE 404 → `handleError` not called.
- [ ] **Step 4: Full suite; commit** `perf(wishlist): parallel delete under at most two ids`

**Phase 2 gate** and PR "Phase 2: domain model (E1)". Update `CLAUDE.md` with a "Domain modules" section naming the three files and the rule: normalize at ingestion, never in components.

---

## Phase 3: Bundle and request hygiene (closes P4, rest of P3)

Branch `perf/arch-fix-phase-3`.

### Task 3.1: Lazy tab panels, vendor chunks, bundle budget in CI

**Files:**
- Modify: `src/pages/TabComponent.jsx:19-24,51-78` (`React.lazy` imports; the existing `Suspense` wrappers stay; `Transcript` gets one too), `src/App.jsx:22-23` (`Login` lazy), `app/vite.config.js` (`build.rollupOptions.output.manualChunks` for `@fullcalendar`, `@azure`, `@dnd-kit`)
- Create: `app/scripts/check-bundle-size.mjs` (reads `dist/assets/index-*.js`, fails if larger than `BUDGET_BYTES = 700_000`)
- Modify: `.github/workflows/ci.yml` (run the script after build)
- Test: `src/pages/__tests__/TabComponent.test.jsx` must still pass (lazy panels resolve under `findBy*`)

- [ ] **Step 1: Run the checker against the current build to see it fail** (`npm run build && node scripts/check-bundle-size.mjs` → exit 1, prints the size)
- [ ] **Step 2: Implement lazy imports and manual chunks**
- [ ] **Step 3: Build, run the checker (exit 0), run the TabComponent and tabTelemetry tests, full suite, lint; commit** `perf(bundle): lazy tab panels and login, vendor chunks, 700 kB budget in CI`

Record the before and after sizes of every chunk in the PR body.

### Task 3.2: Per-session cache for course sheets, per-course ratings and term catalogs

Phase 1 browser verification (2026-11-03): `catalogLoader` dedupes only concurrent loads, so a term's catalog is downloaded again on every revisit and whenever the map re-enriches (HS27 borrowing HS26, FS27 borrowing FS26). The ratings prompt (`recoil/coursesTakenForRatings.js`) fetched the term list five times and `MyCourses/byTerm` for seven terms in three rounds on one cold start; the third round starts when a Recoil promise is caught as an error ("Error fetching courses for rating: Promise").

**Files:**
- Modify: `src/components/helpers/catalogLoader.js` (keep settled results in the module `Map` keyed by `cisId` for the session; a failed load is not cached; `_resetCatalogLoaderForTests` clears it), `src/components/recoil/coursesTakenForRatings.js` (one term-list read and one `MyCourses` request per term per session; stop catching the Recoil promise as an error)
- Create: `src/components/helpers/courseSheetCache.js` (`getCourseSheet({ course, authToken }) -> Promise<sheet|null>` and `getCourseRatings({ courseNumber, authToken })`, each with a module `Map` keyed by course number and `_resetForTests`)
- Modify: `src/components/rightCol/CourseInfo.jsx:49-92,133-175`
- Test: `src/components/helpers/__tests__/courseSheetCache.test.js`

- [ ] **Step 1: Failing tests**: two `getCourseSheet` calls for the same course → one request (MSW counter); a failed fetch is not cached. In `catalogLoader.test.js`: two sequential `loadCatalogForTerm` calls for one `cisId` → one request; after a 500 the next call requests again. In a new `coursesTakenForRatings.test.js`: one cold start → `termsUrl()` hit once and `myCoursesUrl` hit once per term.
- [ ] **Step 1b: Record the cold-start request count** in the browser against a production build (`npm run build && npm run preview`), before and after; the dev build doubles effects under StrictMode. Phase 1 measured 34 requests in dev at af4d0d8.
- [ ] **Step 2: Run, implement, switch `CourseInfo` to the cache, re-run; run the `CourseInfo*` tests; full suite; commit** `perf(course-info): cache course sheets and ratings per session`

**Phase 3 gate** and PR "Phase 3: bundle and request hygiene (P4, P3)".

---

## Phase 4: Configuration and token acquisition (closes E3, E4)

Branch `refactor/arch-fix-phase-4`.

### Task 4.1: `src/config.js` and environment variables

**Files:**
- Create: `src/config.js`, `app/.env.example`, `src/__tests__/config.test.js`
- Modify: `src/components/auth/authConfig.js:13-24,82-84`, `src/components/helpers/axiosClient.js:9,116`, `src/components/helpers/apiEndpoints.js` (hosts come from config), `src/components/helpers/api.js`, `curriculumPlansApi.js`, `similarCoursesApi.js`, `recoil/ApiCustomGrades.jsx`, `recoil/coursesTakenForRatings.js`, `CourseInfo.jsx` (SHSG literals replaced by `SHSG_API`)

**Interfaces:**
- Produces:
  ```js
  export const config = {
    entraClientId: import.meta.env.VITE_ENTRA_CLIENT_ID ?? "67a86d1c-e99b-4b9b-968f-5ac10a21bc5e",
    entraTenantId: import.meta.env.VITE_ENTRA_TENANT_ID ?? "a7262e59-1b56-4f5a-a412-6f07181f48ee",
    unisgApplicationId: import.meta.env.VITE_UNISG_APPLICATION_ID ?? "820e077d-4c13-45b8-b092-4599d78d45ec",
    unisgApiBase: import.meta.env.VITE_UNISG_API_BASE ?? "https://integration.unisg.ch",
    shsgApiBase: import.meta.env.VITE_SHSG_API_BASE ?? "https://api.shsg.ch",
  };
  ```
  `redirectUri` becomes `window.location.origin + "/"`. `isShsgHost` compares against `new URL(config.shsgApiBase).hostname`.

- [ ] **Step 1: Failing tests**: defaults equal the literals above; with `vi.stubEnv("VITE_SHSG_API_BASE", "https://staging.example")`, `isShsgHost("https://staging.example/x")` is true and the production host is false (requires `axiosClient` to read config lazily or the test to re-import with `vi.resetModules`).
- [ ] **Step 2: Run, implement, re-run; `axiosClient.test.js` and `degradedModeService.test.js` must stay green; full suite; lint; commit** `refactor(config): environment-driven tenant, hosts and redirect URI`

### Task 4.2: Client acquires the token when the caller passes none

**Files:**
- Modify: `src/components/auth/tokenService.js` (add `export const getAccessToken = async () => string|null`, silent acquisition for the active account, no event emission on success, reuses `getRefreshToken` semantics on failure), `src/components/helpers/axiosClient.js:95-128,304-365` (request interceptor sets `Authorization` from `getAccessToken()` when the header is absent; `get/post/put/delete` accept `token` of `undefined`)
- Test: extend `src/components/helpers/__tests__/axiosClient.test.js`

- [ ] **Step 1: Failing test**: with `tokenService.getAccessToken` mocked to `"fresh"`, `apiClient.get(url)` (no token) sends `Authorization: Bearer fresh`; with an explicit token, the explicit one wins.
- [ ] **Step 2: Run, implement, re-run; full suite; commit** `feat(http): apiClient acquires the access token itself when none is passed`

New code from here on omits the `authToken` parameter; old call sites migrate when touched. Note this rule in `CLAUDE.md`.

**Phase 4 gate** and PR "Phase 4: configuration and token acquisition (E3, E4)".

---

## Phase 5: Structure and strategy (closes C5, E5; decides E2)

Branch `refactor/arch-fix-phase-5`. Tasks 5.1 to 5.3 are independent.

### Task 5.1: Split `curriculumMapSelector.js` into composable modules

**Files:**
- Create: `src/components/recoil/curriculumMap/categories.js` (`extractCategoryHierarchy`, `flattenCategoriesForGrid`, `extractClassifications` reading `categoryPatterns.json`), `src/components/recoil/curriculumMap/categoryPatterns.json` (the table at `curriculumMapSelector.js:71-136`), `src/components/recoil/curriculumMap/placement.js` (`placeCompletedCourses`, `placeWishlistCourses`, `placeEnrolledCourses`, `placePlannedItems`, each `(ctx, grid) => void` where `ctx = { flatCategories, unifiedCourseData, curriculumPlan, completedCourses }`), `src/components/recoil/curriculumMap/credits.js` (aggregation and `program` statistics), `src/components/recoil/curriculumMap/index.js` (the selectors, composing the above)
- Modify: `src/components/recoil/curriculumMapSelector.js` becomes `export * from "./curriculumMap/index.js"` so imports and the existing 1118-line test keep working
- Test: the existing `curriculumMapSelector.test.js` is the acceptance test; add `curriculumMap/__tests__/categoryPatterns.test.js` asserting the JSON round-trips the previous behaviour for the category names used in the existing test fixtures

- [ ] **Step 1: Run the existing selector test (PASS) and record its count**
- [ ] **Step 2: Move code, one module per commit, running the selector test after each**
- [ ] **Step 3: Full suite, lint; final commit** `refactor(curriculum-map): split selector into categories, placement and credits modules; patterns as data`

### Task 5.2: `withActivePlan` helper in `usePlanManager`, and one toast per plan failure

Phase 1 fix round 2 left two paths that still toast twice: curriculum-plan failures (`curriculumPlansApi.js` reports, then `usePlanManager` calls `toast.error`) and `fetchCurrentEnrollments` (its own report, then `useScorecardFetching`). Decide the owner in each (the hook that knows the user action), remove the other call, and pin with one test per path.

**Files:**
- Modify: `src/components/helpers/usePlanManager.js` (add `const withActivePlan = (label, fn) => useRecoilCallback(({ snapshot, set }) => async (...args) => { const registry = await snapshot.getPromise(curriculumPlansRegistryState); try { const data = await fn({ planId: registry.activePlanId, token, set, snapshot }, ...args); applyServerState(set, data); return true; } catch (e) { if (e?.isDegradedModeError) return false; toast.error(label, { toastId }); return false; } })`; rewrite `addCourseById`, `removeCourseById`, `updatePlacementById`, `addPlaceholderById`, `removePlaceholderById`, `setSemesterNoteById`, `updateWishlistOverridesById` on it)
- Test: `usePlanManager.test.jsx` is the acceptance test (no new tests; behaviour unchanged)

- [ ] **Step 1: Run `usePlanManager.test.jsx` (PASS), refactor one callback at a time, re-run after each; commit** `refactor(plan-manager): withActivePlan removes seven copies of the request/apply/toast pattern`

### Task 5.3: Shared vector-search orchestration

**Files:**
- Create: `src/components/helpers/useVectorSearch.js` (`useVectorSearch() -> { runQuery({ courseDescription, category }) -> Promise<{ ids, distances, metadatas }>, isLoading, isUpserting }`; contains programme derivation, reference-semester resolution and the empty/404 → upsert → retry-once sequence now duplicated in `useSmartSearch.js:29-120` and `SimilarCourses.jsx:78-254`)
- Modify: `useSmartSearch.js`, `SimilarCourses.jsx` (both call `runQuery`; the 800 ms `setTimeout` retry loop is removed; when `program` is not yet known `runQuery` awaits `scorecardFetching.fetchAll` once)
- Test: `src/components/helpers/__tests__/useVectorSearch.test.jsx` (empty result triggers exactly one upsert then one retry; 404 same; second empty result does not upsert again); `smartSearchList.test.jsx` is the regression test for the list

- [ ] **Step 1: Failing tests, implement, switch both consumers, full suite, lint; commit** `refactor(search): one vector-search hook behind smart search and similar courses`

### Task 5.4: State-library decision (E2), produces ADR 0013 and a separate plan

**Files:**
- Create: `docs/adr/0013-state-management-after-recoil.md`, `docs/superpowers/plans/<date>-state-migration.md` (written by this task, executed by its own plan)

- [ ] **Step 1: Spike** (in a throwaway worktree, not merged): migrate `selectedTabAtom`, `smartSearchState` and `smartSearchResultsSelector` to Jotai; count changed lines and test edits; note whether `useRecoilCallback` call sites in `usePlanManager` have a clean equivalent.
- [ ] **Step 2: Spike B**: move the catalog and study-plan loaders to TanStack Query (`useQuery` keyed by `["catalog", cisId]`, `["study-plans"]`), keeping Recoil for the rest; measure request count and code deleted from Phase 1 loaders.
- [ ] **Step 3: Write ADR 0013** with the options from the review (Jotai; TanStack Query plus a small client store; stay), the spike numbers, and a recommendation.
- [ ] **Step 4: Write the migration plan** in this document's format, sized from the spike, and stop. The user decides.

**Phase 5 gate** and PR "Phase 5: structure (C5, E5) and ADR 0013".

---

## Out of scope for this plan

- Stale server wishlist entries: the real HS26 study plan holds full course numbers (`11,902,1.00`, `3,553,1.00`, `3,550,1.00`) that exist in no current catalog, probably saved while HS26 still showed the HS25 preview. Phase 1 hides unresolved ids in the map and Study Overview; removing them is a backend or data-cleanup task.
- `unifiedStudyPlanSelector` and `useAcademicProgress` have no runtime consumer (Phase 1 report). Delete them in Phase 5 with the StudyOverview retirement, or earlier if the overhaul branch does not need them.
- `SendErrorButton` still uses `defaultProps` (React dev warning on every error toast); a two-line change outside any finding.
- Three dev-only PropTypes warnings on the Curriculum Map (`PlanCell` `isCategoryComplete` undefined, `CategoryHeader` `defaultProps`, `PlanItem` numeric `item.courseId`): pre-existing, untouched by Phases 2-5.
- Order of planned/enrolled items inside a Curriculum Map cell follows data-arrival order (seen once in the Phase 5 browser pass); a stable sort in `placement.js` would fix it.
- Vector search races that predate Task 5.3: two overlapping `runQuery` calls share one pair of loading flags, and a course switch during a long upsert writes the previous course's results; a per-request token in `useVectorSearch` would fix both.
- `importSelectedCourses`' degraded-mode branch (dismiss the loading toast, return `{ imported: 0, skipped }`) has no unit test.
- Responsive leftovers from the UI pass: FullCalendar event text is unreadable below 834 px (needs a list or agenda view on phones, not a class change); the Transcript body still scrolls horizontally on phones with no scroll affordance and wraps "120 / ECTS" at 768; Summary course names at 768 truncate earlier than the original 1:1 split (they carry a `title`).
- P3 bullet 6 of the review (switch/create/duplicate plan first upsert the whole current plan, `usePlanManager.js` switchPlan/createPlan/duplicatePlan): not planned in Phases 0-5; it is one extra round trip per plan-level action and needs a backend answer on whether the server state can be trusted without the upsert. C4 ADR numbering gap and an E6 coverage floor in CI: also not planned; small follow-ups.

- Retiring `StudyOverview`, `GradeTranscript`, `selectedCourseIdsAtom` and `scorecardDataState`: blocked on `feature/transcript-overhaul` landing; plan it with that merge.
- Backend changes (single-id delete, per-semester study-plan read, category mapping per regulation): raised as open questions in the review.
- TypeScript adoption: a candidate follow-up after Phase 2 once the domain modules exist.
- Review item C7 remainders: an HTML sanitizer for `CourseInfo` (waits on the trust-boundary answer in the review's open questions), the reactivity bug noted at `SemesterSummary.jsx:37` (a bug fix with its own investigation, not a refactor; Task 1.3 may resolve it, verify at the Phase 1 gate), and the hard-coded course filter at `CourseInfo.jsx:142-144` (needs product confirmation that it can go).

## Progress log

| Task | Status | Commit | Notes |
|---|---|---|---|
| 0.1 | done | 49b0830 | +e035e83 (stable callbacks, fix round 1) |
| 0.2 | done | e1ac0eb | +0ffdf4b (`suppressErrorToast` opt-out, fix round 1) |
| 0.3 | done | 52d7add | also switched useEventListDataManager and useTermSelection |
| 0.4 | done (partial) | ef65f6b | CLAUDE.md is gitignored: doc edits uncommitted, CI step not added; decision pending |
| 0.5 | done | 6806475 | +bbfc650 (per-mount retry, fix round 1); in-flight dedupe added |
| 0.6 | done | dd55b6d | also removed `semesterIndex` prop |
| 0.7 | done | 1f6079b | +debef66 (review simplifications) |
| 1.1 | done | 0af2161 | hook projects 2 terms beyond latest valid (brief said 5 terms; brief was wrong) |
| 1.2 | done | 097b397 | in-flight dedupe only; per-session cache moved to 3.2 |
| 1.3 | done | 9cc5476 | `useEventListDataManager` lost unused `selectionOptions` param |
| 1.4 | done | 3b74096 | +e5ca314 retry on switch while nothing loaded; +c1f1f1a toast opt-out sweep (8 SHSG files) |
| 1.5 | done | c3e53da | `updateSelectedCourseInfo` keeps top-level keys (spread) |
| 1.6 | done | c3fec02 | +d3be9f0, af4d0d8: unresolved wishlist ids hidden in map, study plan and Study Overview; dedupe vs enrolled/placed |
| 1.7 | done | df572e7 + c420f74 | cancel guard; lint fix in second commit |
| 1.8 | done | dc22a4b | +c58b59c simplifications; Transcript error only when nothing loaded |
| 2.1 | done | 0923bd9 + 7cc6ec1 | +654ee85 drops wrappers without production importers; generator/projection year bug fixed and pinned |
| 2.2 | done | d9b6ab5 | absorbs helpers/formatEcts.js; +fabdeda CoursePicker/PlanItem via formatEcts; "4.00"→"4", unknown credits "?" |
| 2.3 | done | cd16e8e | `isCourseSelected` via `sameCourse` (keeps legacy-id entries); sameCourse on the five catalog lookups |
| 2.4 | done | 1b77f7a | ids = {courseNumber, course.id}; `courseId` never differs; one toast only when all deletes fail |
| 3.1 | done | 0740e0c | +94e779f lazyWithReload (deploy-safe lazy chunks), +2e53824 barrel/warning; main chunk 1,474,567 → 648,698 B; Summary eager (user decision) |
| 3.2 | done | 0488f4e | +e351adc sheet cache keyed by hsgEntityId, +d0ff9f4 term list from cisIdList; cold start 22 → 13 requests, reopen/revisit 0 |
| 4.1 | done | 102cb2c | +26ab45b `.env.example` → `.env.development.local`; redirectUri = origin + "/" (same on the three registered hosts) |
| 4.2 | done | 435f4cf | +5c7cbbf token only for exact API origins, lowercase `authorization` honoured, 401 path of a token-less request pinned; no call sites migrated yet |
| 5.1 | done | 898be7b..488cd5a | selector → `recoil/curriculumMap/{categories,placement,credits,index}.js`, keyword table as `categoryPatterns.json` (accumulates every matching pattern in table order, as before); `buildCategoryHierarchy` lives in `credits.js`; `FOCUS_AREA_KEYWORDS` stays in code (different matching rule); 100-test selector suite byte-identical |
| 5.2 | done | 36b1d45 | +4ad4f32 one toast per curriculum-plan and enrolment failure (hooks own the toast; API modules only rethrow), +3cb0139 degraded mode silent in every plan action, `syncActivePlan` on the helper; helper is `useActivePlanAction` (rules-of-hooks); `usePlanManager.js` 1016 → 884 lines |
| 5.3 | done | 5842a8c | +93341ed strict borrowed-term query (null `referenceSemester` → no query), flags reset in `finally`; `useSmartSearch.js` 248 → 56, `SimilarCourses.jsx` 609 → 398, new `useVectorSearch.js`; 800 ms retry timers gone; no programme → empty result once instead of an endless retry |
| 5.4 | done | 9da8d78 | +fdb7e5d (review round 1); ADR 0013 (Proposed) recommends Jotai for all client state if React 19 is wanted within a year, otherwise stay on Recoil and re-decide by 2027-11-01; spikes on local branches `spike/jotai` b071e36 and `spike/tanstack-query` f064c1a (not on this branch); migration plan `docs/superpowers/plans/2026-11-04-state-migration.md` awaits the user's decision |
| UI | done | edf0c83..2e61de9 | user-requested responsive pass outside the review findings: Sonnet audit over 9 viewports (16 findings), 13 fixed + calendar toolbar wrap in seven `fix(ui)` commits; Tailwind-level only; 1280 and 1920 unchanged; audit, screenshots and reviews in the SDD workspace `ui-audit/` |
