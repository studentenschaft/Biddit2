# State Migration Plan: Recoil to Jotai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `recoil` from the app so that React 19 and concurrent rendering become possible, by moving all 92 Recoil state nodes to Jotai in four phases that each leave `dev` shippable: foundation, leaf state, the connected selector graph, and removal.

**Architecture:** Jotai atoms replace Recoil atoms one to one, derived atoms replace selectors, `atomFamily` (from `jotai-family`) replaces `selectorFamily`, and `useAtomCallback` replaces `useRecoilCallback`. Both providers wrap the app until Phase 3. Export names stay the same (`unifiedCourseDataState`, `filteredCoursesSelector`, ...) so imports keep working; only the hooks at the call sites change. The order follows the dependency graph, because a Jotai atom cannot read a Recoil node and a Recoil selector cannot read a Jotai atom: leaves read only by hooks first, then the 55-node connected graph around `unifiedCourseDataState`, `unifiedAcademicDataState` and `curriculumPlanState` in one switch. Server reads keep the Phase 1/3 loaders (`catalogLoader.js`, `useStudyPlanDataSimplified.js`, `courseSheetCache.js`); this plan does not introduce TanStack Query.

**Tech Stack:** React 18.3, Vite 6, Recoil 0.7.7 (removed by this plan), Jotai 3.0.x + jotai-family 1.1.x, Vitest 4 + @testing-library/react 16 + MSW 2, ESLint 8.

**Spec:** `docs/adr/0013-state-management-after-recoil.md` (decision, spike numbers, findings). Spike branches: `spike/jotai` at b071e36 (ported by Task 0.2; also holds the `useAtomCallback` proof in `app/src/spike/`), `spike/tanstack-query` at f064c1a (reference only).

## Global Constraints

- All commands run from `app/`: `cd app` first. File paths below are relative to `/Users/marc/Documents/GithubRepos/BidditRepos/Biddit2/` unless they start with `src/`, which is `app/src/`.
- Run tests with an explicit timeout: `npx vitest run --testTimeout=10000 <file>`. The full suite: `npx vitest run --testTimeout=10000`. There is no `timeout` binary on macOS.
- `npm run lint` must pass with **0 warnings** before every commit. `npm run build && npm run check-bundle` must succeed at every phase gate. From Task 0.1 on, `npm run check-recoil` must pass too, and each task lowers its limits to the new counts.
- Conventional Commits. **No "Co-Authored-By: Claude" or any Claude Code mention in commit messages.**
- One branch per phase, cut from `dev`: `refactor/state-jotai-phase-0` to `refactor/state-jotai-phase-3`. Commit per task. **Do not push or merge without explicit user approval.** Use a git worktree per phase branch (superpowers:using-git-worktrees).
- Do not change user-visible behaviour. Every task ends with the full suite green, except inside Task 2.1, which says how it handles that.
- Imports: `atom`, `useAtom`, `useAtomValue`, `useSetAtom`, `Provider`, `createStore` from `jotai`; `useAtomCallback`, `unwrap` from `jotai/utils`; `atomFamily` from `jotai-family`. Recoil keys go away; keep the export names.
- No derived state across the two libraries. Where a hook must join a Jotai atom and a Recoil node, it is a *bridge*: only the bridges this plan names may exist, each is listed in the Progress log, and the task named there deletes it.
- Tests seed and read state through `src/test/renderWithState.jsx` (Task 0.1). Never rely on Jotai's provider-less default store in a test: it is shared by all tests of a file. `snapshot_UNSTABLE` in selector tests becomes `createStore()` plus `store.set`/`store.get`.
- A function that tests call inside a synchronous `act(() => ...)` must not return a promise (the write function of a writable atom, an invalidation callback). A returned promise turns `act` into an unawaited async scope and silently stops later tests in the file from rendering (Spike B).
- Never call `api.shsg.ch` or `integration.unisg.ch` except through `apiClient`; the only permitted `fetch` calls stay `degradedModeService.js` and `examScheduleAtom.js`.
- `CLAUDE.md` is gitignored. When a task changes something its "State Management" section names, update the local copy and say so in the report; do not commit it.
- Do not merge any phase during a bidding window.

## Decisions required before Phase 0

The plan proceeds with the defaults below. Change them here before Phase 0 starts if they are wrong.

| Decision | Default used by this plan | Where it matters |
|---|---|---|
| Is a React 19 upgrade wanted within the next year? | Yes, answered by the maintainer on 2026-11-04 (ADR 0013 is Accepted on that basis). | Whole plan |
| Jotai major version | 3.x. It requires Node 22.12 or later, so `engines.node` becomes `>=22.12`; CI already runs Node 22. | Task 0.1 |
| Provider | An explicit Jotai `<Provider>` inside `RecoilRoot` in `main.jsx`; every test gets its own store. | Task 0.1 |
| How the connected graph moves | One switch on a sub-branch (Task 2.1). The alternative, a Recoil atom effect that mirrors each source atom into Jotai so selectors can move in slices, was not tested in the spikes and adds temporary sync code. This is an open design question for the user: choosing the mirror means re-planning Phase 2 (no task here implements it) before Phase 2 starts. | Task 2.1 |
| Directory name | Keep `src/components/recoil/` during the migration; Task 3.2 renames it to `src/components/state/`. | Task 3.2 |

## Review Focus

Input classes the migration could break that no existing test pins. Each line names the task that adds the pinning test.

1. A tab or column change under `StrictMode` must emit exactly one telemetry event after the atom effects become write-through atoms; setting the same value again emits none. Task 0.2 (`analyticsAtomEffects.test.jsx` keeps its assertions; add the StrictMode case for `isLeftViewVisible`).
2. Two renders with the test helper must not share state. Task 0.1 (`renderWithState.test.jsx` "two renders get independent stores").
3. `semesterCoursesSelector({ semester, type })` takes an object: the same parameters must return the same atom, or every render subscribes to a new one. Task 2.1 (`expect(semesterCoursesSelector({ semester: "HS25", type: "enrolled" })).toBe(semesterCoursesSelector({ semester: "HS25", type: "enrolled" }))`).
4. A seeded exam plan must not trigger a load, and an unseeded one loads once per semester per store. Task 2.1 (`examPlanState.test.jsx` keeps its assertions on a store-based harness).
5. `useAtomCallback` rebuilds its function whenever the callback reference changes, while `useRecoilCallback(..., [token])` kept the plan-manager functions stable. Unstable identities re-run every effect that lists them (for example the plan load in `CurriculumMap`) and refetch. Task 2.1 (`usePlanManager.test.jsx` "returns stable functions across re-renders": `renderHook` with a fixed token, `rerender()`, then each of the 15 returned functions is `toBe` the one from the first render; green on Recoil before the switch, fails if a converted callback lacks stable `useCallback` dependencies).
6. Smart search results must still fall back to the keyword pool when the semester changes under them, after the bridge hook becomes derived atoms. Task 2.1 (`smartSearchList.test.jsx`, unchanged assertions).

---

## Orchestration guide

**Roles.** As in `docs/superpowers/plans/2026-11-03-architecture-review-fix-plan.md`: one fresh Opus 5.5 implementer per task, briefed with this file's header, Global Constraints, the task text and the Interfaces blocks it consumes; one fresh Opus 5.5 reviewer per task running `/ponytail-review` on the diff, then a correctness check against the task's test steps; the orchestrator dispatches, runs the phase gate and asks the user before any push.

**Phase gate.**

```bash
cd app && npm run lint && npm run check-recoil && npx vitest run --testTimeout=10000 && npm run build && npm run check-bundle
```

Record the main-chunk size at each gate in the PR body (baseline 647,148 B at 93341ed; Spike A measured +8,361 B for Jotai beside Recoil).

| Phase | Parallel groups (run left to right; items in one group may run concurrently) |
|---|---|
| 0 | {0.1} then {0.2} |
| 1 | {1.1} then {1.2} then {1.3} then {1.4} (sequential: each lowers the limits in `check-recoil-imports.mjs`) |
| 2 | {2.1} |
| 3 | {3.1} then {3.2} |

**Size, from Spike A.** Spike A moved 4 nodes and 12 of 149 production hook calls with 15 source files (+141 / −118) and 6 test files (+69 / −62). Expected sizes: Task 0.2 about the spike's diff; Tasks 1.2 to 1.4 about 50 production and 30 test files together; Task 2.1 about 75 production and 45 test files, 1,500 to 2,500 changed lines; Task 3.2 is a path rewrite across about 150 files.

**Definition of done for a task.** Its steps are checked, its named tests pass, lint is clean, `check-recoil` passes with lowered limits, the full suite is green, the commit exists, the reviewer has no open finding.

---

## Phase 0: Foundation and the spike port

Branch `refactor/state-jotai-phase-0`.

### Task 0.1: Jotai dependency, provider, test helper and a Recoil import ratchet

**Files:**
- Modify: `app/package.json` (add `jotai@^3.0.1`, `jotai-family@^1.1.0`; `engines.node` `>=22.12`; script `"check-recoil": "node scripts/check-recoil-imports.mjs"`), `src/main.jsx` (Jotai `Provider` inside `RecoilRoot`), `.github/workflows/ci.yml` (run `npm run check-recoil` after lint)
- Create: `src/test/renderWithState.jsx`, `app/scripts/check-recoil-imports.mjs`
- Test: `src/test/__tests__/renderWithState.test.jsx`

**Interfaces:**
- Produces:
  ```js
  // src/test/renderWithState.jsx
  export function stateWrapper({ recoil, atoms = [] } = {})
    // recoil: (recoilInterface) => void, forwarded to RecoilRoot initializeState (option removed in Task 3.1)
    // atoms: Array<[atom, value]>, set on a fresh createStore() before the first render
    // -> { wrapper, store }  (for renderHook)
  export function renderWithState(ui, { recoil, atoms = [] } = {}) // -> RTL render result plus { store }
  // Components: renderWithState(<X />, { atoms: [[someAtom, value]] }); hooks: renderHook(fn, { wrapper: stateWrapper({ atoms }).wrapper })
  ```
  `check-recoil-imports.mjs` counts files under `src/` that import from `"recoil"`, separately for production and test files, prints both, and exits 1 when either exceeds `MAX_PRODUCTION_FILES` / `MAX_TEST_FILES`. Split rule (the same as ADR 0013's table): a file is a test file when its path contains `__tests__/` or starts with `src/test/`. Initial limits: the counts on the branch point. On 93341ed they are 97 production and 59 test files (`src/test/resilience/degradedMode.test.jsx` counts as a test); re-count on `dev` when the task starts and use those numbers.

- [ ] **Step 1: Write the failing helper tests**: "two renders get independent stores" (set an atom through the first render's store; the second render reads the default); "seeds atoms before the first render" (a probe component reads the seeded value on its first render); "forwards the recoil seed" (a Recoil atom seeded through `recoil` is visible).
- [ ] **Step 2: Run to verify failure, implement the helper, re-run**: `npx vitest run --testTimeout=10000 src/test/__tests__/renderWithState.test.jsx` → FAIL, then PASS.
- [ ] **Step 3: Install, wire the provider, add the script and the CI step**; `npm run check-recoil` prints the two counts (97 and 59 if `dev` still matches 93341ed) and exits 0.
- [ ] **Step 4: Full suite, lint, build; commit** `chore(state): add Jotai beside Recoil, per-test store helper and a Recoil import ratchet`

### Task 0.2: Navigation and smart-search state on Jotai (port of Spike A)

**Files:**
- Modify: as in `spike/jotai` b071e36 without `src/spike/` (`selectedTabAtom.js`, `smartSearchAtom.js`, `unifiedCourseDataSelectors.js`, `App.jsx`, `pages/Biddit2.jsx`, `useOpenCourseDetails.js`, `useSmartSearch.js`, `EventListContainer.jsx`, `SearchModeToggle.jsx`, `SearchTerm.jsx`, `SelectOptions.jsx`, `SemesterRow.jsx`, `StudyOverviewMigrationNotice.jsx`), plus `src/components/recoil/isLeftViewVisible.js`, `src/components/recoil/courseDetailsSemesterAtom.js` and their readers (`pages/Biddit2.jsx`, `leftCol/bottomRow/EventListContainer.jsx`, `rightCol/CourseInfo.jsx`, `useOpenCourseDetails.js`)
- Create: `src/components/helpers/useSmartSearchResults.js` (BRIDGE-1), `src/components/recoil/atomWithOnChange.js`
- Test: the six test files the spike edited, moved onto `renderWithState`; `CourseInfoExamInformation.test.jsx`; `analyticsAtomEffects.test.jsx` gains the `isLeftViewVisible` StrictMode case

**Interfaces:**
- Produces:
  ```js
  export const atomWithOnChange = (initialValue, onChange) => WritableAtom
    // reads the value; a write (value or updater) that changes it stores it, then calls onChange(next, previous); returns nothing
  export const selectedTabAtom      // atomWithOnChange(TAB.SUMMARY, trackTabSelect)
  export const isLeftViewVisible    // atomWithOnChange(false, (next) => trackColumnSwitch(next)); the test asserts the one-argument call
  export const courseDetailsSemesterAtom, smartSearchState   // plain atoms, same defaults
  export function isSmartSearchActive(search, selectedSemester) -> boolean          // smartSearchAtom.js, pure
  export function smartSearchResults(search, semesterData, ratings) -> Course[]     // smartSearchAtom.js, pure
  export function useSmartSearchResults() -> { search, results, active }            // BRIDGE-1, deleted in Task 2.1
  ```
  `smartSearchResultsSelector` and `smartSearchActiveSelector` are deleted.

- [ ] **Step 1: Port the spike**: `git cherry-pick -n b071e36`. It conflicts in `app/src/main.jsx`, `app/package.json` and `app/package-lock.json`, because Task 0.1 already added the provider and the dependency: keep Task 0.1's versions (`git checkout HEAD -- app/src/main.jsx app/package.json app/package-lock.json`). Delete `src/spike/`. Replace the spike's write-through atom in `selectedTabAtom.js` with `atomWithOnChange`.
- [ ] **Step 2: Move `isLeftViewVisible` and `courseDetailsSemesterAtom`** and their readers; add the StrictMode case for `isLeftViewVisible` to `analyticsAtomEffects.test.jsx`.
- [ ] **Step 3: Move the touched tests onto `renderWithState`**; assertions stay as they are.
- [ ] **Step 4: Run** `npx vitest run --testTimeout=10000 src/components/recoil src/components/leftCol src/components/helpers/__tests__/useOpenCourseDetails.test.jsx src/components/rightCol src/pages` → PASS. Full suite, lint, lower the `check-recoil` limits, build.
- [ ] **Step 5: Commit** `refactor(state): navigation and smart-search state on Jotai`

**Phase 0 gate** and PR "State migration phase 0: Jotai foundation (ADR 0013)".

---

## Phase 1: Leaf state and the two small graphs

Branch `refactor/state-jotai-phase-1`. Every node here is read only by hooks, or belongs to a graph that does not touch the Phase 2 graph.

### Task 1.1: Delete state nodes that nothing reads

**Files:**
- Modify: the defining files of the candidates below, their tests if any

Candidates (no reader on 93341ed apart from their own file): `curriculumCategoriesSelector`, `curriculumSemestersSelector`, `curriculumProgramSelector` (`recoil/curriculumMap/index.js`), `activePlanMetadataSelector`, `scorecardEnrollmentsState`, `enrolledCoursesSelector`, `latestValidTermSelector`, `semesterCisIdSelector`, `semesterIsCurrentSelector`, `semesterIsProjectedSelector`, `academicDataInitializationSelector`, `referenceSemester` (`isFutureSemesterSelected.js`). Keep `currentProgramTranscriptSelector` (CLAUDE.md names it as the target API for academic data).

- [ ] **Step 1: For each candidate, list the files that import it** (`grep -rlw "<name>" src`, then check each hit for an actual import of that export: imports span several lines, and names such as `referenceSemester` are also field names); delete it only when nothing imports it apart from a test of only that node. List the deleted and the kept names in the commit body.
- [ ] **Step 2: Full suite, lint, `check-recoil` (limits lowered if a file lost its last Recoil import); commit** `refactor(state): delete state nodes without readers`

### Task 1.2: Review-flow and dev-mode atoms

**Files:**
- Modify: `src/components/recoil/reviewCourse.js` (10 atoms), `src/components/recoil/reviewMenuModal.js`, `src/components/testing/devModeAtom.js`, `src/components/testing/devModeSelectedDegreeAtom.js`, readers `leftCol/sideNav/ReviewButton.jsx`, `leftCol/sideNav/ReviewCourse.jsx`, `testing/DegreeSelector.jsx`, `testing/DevModeBanner.jsx`, `testing/useRefreshMockData.jsx`, and every other file `grep` finds for these names
- Test: `leftCol/sideNav/__tests__/sideNavDialogLayout.test.jsx`, `sideNavDialogStacking.test.jsx` (seed through `renderWithState`)

**Interfaces:**
- Produces: the same export names as plain Jotai atoms with the same defaults.

- [ ] **Step 1: Convert the definitions and readers; run** `npx vitest run --testTimeout=10000 src/components/leftCol/sideNav` → PASS
- [ ] **Step 2: Full suite, lint, `check-recoil`; commit** `refactor(state): review and dev-mode atoms on Jotai`

### Task 1.3: Remaining leaf data atoms

**Files:**
- Modify: `customGradesAtom.js`, `examinationTypesAtom.js`, `scorecardDetailsAtom.js`, `scorecardsAllRawAtom.js`, `selectedCourseIdsAtom.js`, `shsgCourseRatingsAtom.js`, `currentEnrollmentsAtom.js`, `termListState.js`, `studyPlanLoadState.js` (incl. `useInvalidateStudyPlan`), `initializedProgramsState` (in `unifiedAcademicDataAtom.js`) and `initializedSemestersState` (in `unifiedCourseDataAtom.js`); readers found by `grep` (expected: `useCourseRatingsData.js`, `useCourseSelection.js`, `useCurriculumMapCourseLoader.js`, `useCustomGrades.js`, `useScorecardFetching.js`, `useStudyPlanDataSimplified.js`, `useTermSelection.js`, `useUnifiedAcademicData.js`, `useUnifiedCourseDataWriters.js`, `useUnifiedCourseLoader.js`, `useVectorSearch.js`, `rightCol/CourseInfo.jsx`, `rightCol/Transcript.jsx`, `pages/TabComponent.jsx`)
- Test: `scorecardBootstrapOnce.test.jsx`, `universityApiViaClient.test.jsx`, `useCourseSelection.remove.test.jsx`, `useStudyPlanDataSimplified.test.jsx`, `Transcript.errorState.test.jsx`, `examinationTypesFetchGuard.test.jsx`, `useTermSelection.test.jsx`

**Interfaces:**
- Produces: the same export names as plain Jotai atoms with the same defaults; `useInvalidateStudyPlan()` keeps returning a function that returns nothing.

A hook that writes both a moved atom and a Phase 2 atom (for example `useUnifiedCourseDataWriters` with `initializedSemestersState` and `unifiedCourseDataState`) uses `useSetAtom` for the first and keeps `useSetRecoilState` for the second; that is not a bridge, because nothing derives across them.

- [ ] **Step 1: Convert one atom file at a time with its readers, running that atom's tests after each**
- [ ] **Step 2: Full suite, lint, `check-recoil`; commit** `refactor(state): leaf data atoms on Jotai`

### Task 1.4: Auth token and the ratings prompt

**Files:**
- Modify: `recoil/authAtom.js`, `recoil/cisIdListAtom.js`, `recoil/cisIdListSelector.js` (async selector), `recoil/latestValidTermProjection.js`, `recoil/coursesTakenForRatings.js` (two atoms, two async selectors), readers found by `grep` (expected: `auth/AuthProvider.jsx`, `useInitializeScorecards.js`, `usePlanManager.js` (its `useRecoilValue(authTokenState)` only), `useTermSelection.js`, `useVectorSearch.js`, `useCustomGrades.js`, `EventListContainer.jsx`, `LockOpen.jsx`, `ReviewButton.jsx`, `ReviewCourse.jsx`, `CourseInfo.jsx`, `CurriculumMap.jsx`, `Heatmap.jsx`, `StudyOverview.jsx`, `Transcript.jsx`, `studyOverviewHelpers.js`)
- Test: `recoil/__tests__/coursesTakenForRatings.test.jsx` is the acceptance test (one term-list read and one `MyCourses` request per term on a cold start); the 21 tests that seed `authTokenState` move the seed to `renderWithState(ui, { atoms: [[authTokenState, "t"]] })` (components) or `stateWrapper({ atoms: [[authTokenState, "t"]] })` (`renderHook`)

**Interfaces:**
- Produces: `authTokenState`, `cisIdList`, `latestValidTermProjectionState`, `coursesRatedState`, `coursesTakenForRatingState` as Jotai atoms; `cisIdListSelector` and the ratings-prompt selectors as async derived atoms (`atom(async (get) => ...)`), read with `useAtomValue` under the existing `Suspense` boundaries.

- [ ] **Step 1: Convert the six nodes and the readers; run** `npx vitest run --testTimeout=10000 src/components/recoil/__tests__/coursesTakenForRatings.test.jsx` → PASS with the request counts unchanged
- [ ] **Step 2: Full suite, lint, `check-recoil`; commit** `refactor(state): auth token and ratings prompt on Jotai`

**Phase 1 gate** and PR "State migration phase 1: leaf state (ADR 0013)".

---

## Phase 2: The connected selector graph

Branch `refactor/state-jotai-phase-2`.

### Task 2.1: Switch the course-data, academic-data and curriculum-plan graph

The 55 nodes around `unifiedCourseDataState`, `unifiedAcademicDataState` and `curriculumPlanState` read each other through `get(...)`, so they switch together (fewer after Task 1.1). The curriculum-plan registry (`curriculumPlansRegistryState`, `planListSelector`) joins them because `usePlanManager` writes both in one callback.

Work on a sub-branch `refactor/state-jotai-graph` cut from the phase branch. Commit after each step; the suite is expected to be red between Step 2 and Step 7. The orchestrator may hand the task to a fresh implementer at any step boundary. The task ends with the suite green and the sub-branch merged into the phase branch with `--no-ff`.

**Files:**
- Modify (definitions): `unifiedCourseDataAtom.js`, `unifiedCourseDataSelectors.js`, `selectionOptionsAtom.js`, `courseInfoAtom.js`, `classificationsListSelector.js`, `ectsListSelector.js`, `languageListSelector.js`, `lecturersListSelector.js`, `isFutureSemesterSelected.js`, `calendarEntriesSelector.js`, `examScheduleAtom.js`, `examScheduleSelectors.js`, `unifiedAcademicDataAtom.js`, `unifiedAcademicDataSelectors.js`, `coursesWithTypesSelector.js`, `curriculumPlanAtom.js`, `curriculumPlansRegistryAtom.js`, `curriculumPlansSelectors.js`, `curriculumMap/index.js`, `smartSearchAtom.js`
- Modify (writers and readers): every production file `grep -rlE "useRecoil|useSetRecoilState" src` still lists after Phase 1 (expected about 55, among them `useUnifiedCourseDataWriters.js`, `useUnifiedCourseData.js`, `useUnifiedAcademicData.js`, `usePlanManager.js`, `useCurriculumPlan.js`, `EventListContainer.jsx`, the `leftCol/topRow/Select*.jsx` filters, `Calendar.jsx`, `Heatmap.jsx`, `SemesterSummary.jsx`, `CourseInfo.jsx`, `ExamSchedule.jsx`, `ExamTable.jsx`, the `CurriculumMap/` components, `StudyOverview.jsx`, `Transcript.jsx`, `TabComponent.jsx`)
- Delete: `src/components/helpers/useSmartSearchResults.js` (BRIDGE-1)
- Test: every test that seeds or reads these nodes (expected about 45, listed by `grep -rlE "initializeState|snapshot_UNSTABLE|RecoilRoot" src`), including the 8 `snapshot_UNSTABLE` selector tests and `src/test/resilience/degradedMode.test.jsx`; plus `rightCol/__tests__/calendarEventSheetGating.test.jsx` and `rightCol/__tests__/calendarExamEvents.test.jsx`, which the grep misses: they stub `Calendar.jsx`'s reads with `vi.mock("recoil", ...)`, and that mock stops intercepting after Step 4, so they need a Jotai seed instead

**Interfaces:**
- Consumes: `renderWithState` (Task 0.1), `isSmartSearchActive`, `smartSearchResults` (Task 0.2), the `useActivePlanAction` proof in `spike/jotai:app/src/spike/jotaiPlanActionProof.js`.
- Produces (same export names; only the definitions change):
  ```js
  export const unifiedCourseDataState = atom(<same default>)
  export const semesterCourseDataSelector = atomFamily((semester) => atom((get) => ...))   // and the other string-keyed families
  export const semesterCoursesSelector = atomFamily(
    ({ semester, type }) => atom((get) => ...),
    (a, b) => a.semester === b.semester && a.type === b.type
  )
  export const smartSearchActiveSelector = atom((get) => isSmartSearchActive(get(smartSearchState), get(selectedSemesterSelector)))
  export const smartSearchResultsSelector = atom((get) => smartSearchResults(get(smartSearchState), get(semesterCourseDataSelector(sel)), get(semesterRatingsSelector(sel))))
  export const examPlanState = atomFamily((semester) => WritableAtom<{ status, plan }>)
    // a value set on it wins; otherwise the first read in a store starts loadExamPlan(semester)
    // through unwrap() and returns { status: "loading", plan: null } until it settles
  ```
  `usePlanManager` keeps its return value. `useActivePlanAction(token, action, options)` becomes `useAtomCallback(useCallback(async (get, set, ...args) => ..., deps))` with the same dependencies as today (`[token]`; `[token, isDegradedMode]` for `loadPlans`). The inline `action` closure must not be a dependency (the spike proof lists it, which is fine for a proof but unstable in the hook): keep it in a ref or build it inside the `useCallback`. Each `await snapshot.getPromise(x)` becomes `get(x)`, read once at the start of the callback as before.

- [ ] **Step 1: Pin before switching (green on Recoil)**: add the Review Focus 5 test to `usePlanManager.test.jsx`. Run `npx vitest run --testTimeout=10000 src/components/helpers/__tests__/usePlanManager.test.jsx` → PASS. Commit. (The Review Focus 3 identity test only applies to `atomFamily`; it is added in Step 5.)
- [ ] **Step 2: Convert the definitions**, file by file in the order of the Files list (atoms first, then selectors that read them). `selector({ key, get: ({ get }) => B })` becomes `atom((get) => B)`; families as above; the exam-plan loader as above. Commit.
- [ ] **Step 3: Convert the writers** (`useUnifiedCourseDataWriters`, `useUnifiedAcademicData`, `useCurriculumPlan`) and `usePlanManager` (8 `useRecoilCallback`, 13 `snapshot.getPromise`). Commit.
- [ ] **Step 4: Convert the readers**: `useRecoilValue` → `useAtomValue`, `useRecoilState` → `useAtom`, `useSetRecoilState` → `useSetAtom` for the moved nodes. Delete BRIDGE-1 and read the two smart-search atoms in `EventListContainer.jsx`. Commit.
- [ ] **Step 5: Convert the selector tests**: `snapshot_UNSTABLE(({ set }) => ...)` → `const store = createStore(); store.set(...)`; `snapshot.getLoadable(x).getValue()` → `store.get(x)`. Add the Review Focus 3 identity test to `filteredCoursesSelector.test.js`. Run `npx vitest run --testTimeout=10000 src/components/recoil` → PASS. Commit.
- [ ] **Step 6: Convert the component and hook tests** to `renderWithState(ui, { atoms: [...] })` or `stateWrapper({ atoms: [...] })`, including the two `vi.mock("recoil")` tests. Commit.
- [ ] **Step 7: Verify**: `grep -rnE "from ['\"]recoil['\"]" src` lists no file that mentions a node of this task; `npx vitest run --testTimeout=10000` → all pass; the Review Focus 3 to 6 tests pass; lint; `check-recoil` with lowered limits; build and `check-bundle`. Merge the sub-branch: `git merge --no-ff refactor/state-jotai-graph -m "refactor(state): course, academic and curriculum-plan state on Jotai"`.

**Phase 2 gate**, a browser smoke test by the user on a production build (`npm run build && npm run preview`: course list with filters, smart search, wishlist toggle, Calendar, Curriculum Map drag and drop, Transcript), and PR "State migration phase 2: selector graph (ADR 0013)".

---

## Phase 3: Remove Recoil

Branch `refactor/state-jotai-phase-3`.

### Task 3.1: Drop the dependency and the provider

**Files:**
- Modify: `app/package.json` (remove `recoil`), `src/main.jsx` (remove `RecoilRoot`), `src/test/renderWithState.jsx` (remove the `recoil` option), the tests that still pass it, `app/.eslintrc*` (`no-restricted-imports` for `recoil`), `.github/workflows/ci.yml` and `app/package.json` (remove the `check-recoil` step and script)
- Delete: `app/scripts/check-recoil-imports.mjs`

- [ ] **Step 1: `grep -rnE "recoil" src`** returns only comments; remove or reword them.
- [ ] **Step 2: Remove the dependency, the provider and the ratchet; add the lint rule.** Full suite, lint, build, `check-bundle`; record the main-chunk size (ADR 0013 expects about 62 kB less than at the Phase 0 gate).
- [ ] **Step 3: Commit** `chore(state): remove Recoil`

### Task 3.2: Rename `components/recoil/` to `components/state/`

**Files:**
- Move: `src/components/recoil/` → `src/components/state/` (`git mv`)
- Modify: every import of `/recoil/` (about 150 files; rewrite with one `sed` over `src`, then review the diff)

- [ ] **Step 1: Move and rewrite imports; `grep -rn "/recoil/" src`** returns nothing.
- [ ] **Step 2: Full suite, lint, build; commit** `refactor(state): rename the state directory`. Update the local `CLAUDE.md` (State Management section, file structure list).

**Phase 3 gate** and PR "State migration phase 3: Recoil removed (ADR 0013)".

---

## Out of scope for this plan

- The React 19 upgrade and removing `useTransitions={false}` from the router in `App.jsx`. Both become possible after Task 3.1; the router flag changes navigation timing, so it needs its own browser-verified change. Plan them together.
- TanStack Query. ADR 0013 keeps it as a later option for server state once all client state is in Jotai (`jotai-tanstack-query`), if background refetch or optimistic mutations become needs. Spike B showed no request savings over the Phase 1/3 loaders today.
- Renaming the `…State` / `…Selector` exports to Jotai conventions. The names stay to keep the migration diffs to the call sites.
- Retiring `StudyOverview`, `GradeTranscript`, `selectedCourseIdsAtom` and `scorecardDataState`: still blocked on `feature/transcript-overhaul`. Phase 1 ports them as they are.
- Migrating the remaining `authToken` parameters to `apiClient`'s own token acquisition (architecture-review fix plan, Task 4.2 note). Task 1.4 only moves the atom.

## Progress log

| Task | Status | Commit | Notes |
|---|---|---|---|
| 0.1 | | | |
| 0.2 | | | creates BRIDGE-1 |
| 1.1 | | | |
| 1.2 | | | |
| 1.3 | | | |
| 1.4 | | | |
| 2.1 | | | deletes BRIDGE-1 |
| 3.1 | | | |
| 3.2 | | | |

**Bridges** (hooks that join Jotai and Recoil state; each must be deleted by the named task):

| Id | Hook | Created | Deleted by |
|---|---|---|---|
| BRIDGE-1 | `useSmartSearchResults` (smart-search atom with the Recoil course-data selectors) | 0.2 | 2.1 |
