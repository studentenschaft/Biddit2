# Architecture review, 2026-11-03

Scope: `app/` on branch `dev` at `ba8c8b0`. Read-only assessment of cleanliness, performance and expandability. Line numbers refer to that commit.

Method: orientation pass over entry points, routing, state, HTTP and test setup; deep reads of the course-data layer, academic-data layer, curriculum map, auth and error infrastructure, and the largest components; three factual traces (outbound HTTP calls, atom writers, curriculum-plan write path) whose results were checked against the code before use. The test suite and linter were run once.

---

## 1. Executive summary

The foundation is healthier than the age of some files suggests. The HTTP client, session handling, degraded-mode kill switch, tab model and exam-schedule pipeline are well designed, documented in ADRs and covered by tests. The suite is fast and green (86 files, 989 tests, 11 s) and CI runs lint, tests and build on every push.

The weak point is the data layer between the two external APIs and the UI. Raw API shapes flow through the whole app, and every consumer re-derives course identity, credit units, semester keys and "current semester" with its own heuristic. Derived data (`filtered`) is stored in the main atom and recomputed by effects. Thirteen hooks subscribe to the entire course atom. One component definition inside a render function remounts every virtualized row on every parent render. Two bootstrap paths write the academic atom with duplicated transform code. Several hooks bypass the shared HTTP client, so the largest request in the app gets none of the retry or token-refresh behaviour that the documentation promises.

The five findings that matter most:

1. No normalized domain model at the API boundary (E1). Identity, credits and semester logic are duplicated in 10 to 15 files each and already disagree with one another.
2. `Row` is declared inside `EventListContainer`'s render (P1). Every list render remounts all rows.
3. Whole-atom subscriptions and stored derived state (P2). Any write to any semester re-renders 13 hosts; `filtered` is recomputed by three overlapping effects.
4. University-API calls outside `apiClient` (C1). Five call sites use raw `axios` or `fetch`, bypassing retry, backoff, 401 refresh and offline detection.
5. Recoil 0.7.7 is unmaintained and pins the app to React 18 non-concurrent rendering (E2). Each new atom raises the exit price.

Tackle first, in order: hoist `Row` and switch hooks to setter-only subscriptions (hours), route the five raw calls through `apiClient` (half a day), fix the stale `CLAUDE.md` entries (an hour), then start the domain-normalization module and apply it at `updateAvailableCourses` before building more on top.

---

## 2. Architecture overview

Single-page React 18 app (Vite) with no backend code in this repo. Two upstream APIs: the university Event/Achievement/Study APIs (`integration.unisg.ch`, authenticated with an Entra ID token) and the SHSG API (`api.shsg.ch`, same token; wishlist, ratings, curriculum plans, vector search, custom grades). Static assets on the CDN carry two pieces of runtime configuration: `app-status.json` (kill switch) and `exams/<semester>.json` (exam plans).

```mermaid
flowchart TB
  subgraph Shell
    main[main.jsx: RecoilRoot > AuthProvider > App]
    App[App.jsx: ErrorBoundary > AppStateProvider > Router]
    B2[pages/Biddit2.jsx: DndContext, two columns]
    Tabs[pages/TabComponent.jsx + constants/tabs.js]
  end

  subgraph Left["Left column (browse)"]
    SelOpt[SelectOptions: semester + filters]
    ELC[EventListContainer: react-window list]
  end

  subgraph Right["Right column (tabs)"]
    CI[CourseInfo + SimilarCourses + ExamSchedule]
    Cal[Calendar: FullCalendar]
    Sum[SemesterSummary]
    CM[CurriculumMap grid]
    SO[StudyOverview, legacy]
    Tr[Transcript, legacy]
  end

  subgraph State["Recoil state"]
    UCD[(unifiedCourseDataState\nsemesters[sem].available/filtered/\nselectedIds/enrolledIds/ratings)]
    UAD[(unifiedAcademicDataState\nprograms[name].transcript/studyPlan)]
    CP[(curriculumPlanState +\ncurriculumPlansRegistryState)]
    Legacy[(legacy atoms: localSelectedCoursesSemKey,\nscorecardDataState, cisIdList, termListState ...)]
    Sel[selectors: unifiedCourseDataSelectors,\nunifiedAcademicDataSelectors,\ncurriculumMapSelector, calendarEntriesSelector]
  end

  subgraph Hooks["Orchestration hooks (helpers/)"]
    TS[useTermSelection]
    EDM[useEventListDataManager\n-> useCourseInfoData, useEnrolledCoursesData,\nuseStudyPlanDataSimplified, useCourseRatingsData]
    UCDh[useUnifiedCourseData: all atom writes]
    SC[useInitializeScorecards / useScorecardFetching]
    PM[usePlanManager / useCurriculumPlan]
    CML[useCurriculumMapCourseLoader / useUnifiedCourseLoader]
  end

  subgraph IO["I/O layer"]
    AC[axiosClient.js: apiClient singleton\ninterceptors: offline, degraded, 401 refresh, retry]
    TSvc[auth/tokenService.js + authConfig.js: MSAL]
    DM[degradedModeService.js: polls app-status.json]
    EH[ErrorHandlingService: classify, toast]
    raw[raw axios / fetch\n5 call sites]
  end

  UNI[(integration.unisg.ch)]
  SHSG[(api.shsg.ch)]
  CDN[(static: app-status.json, exams/*.json)]

  main --> App --> B2 --> Tabs
  B2 --> SelOpt --> ELC
  Tabs --> CI & Cal & Sum & CM & SO & Tr
  SelOpt --> TS
  ELC --> EDM
  EDM --> UCDh --> UCD
  TS --> UCDh
  TS --> raw
  EDM --> raw
  CML --> raw
  CM --> PM --> CP
  CM --> CML
  CM & SO & Tr --> SC --> UAD
  Sel --> UCD & UAD & CP & Legacy
  Right --> Sel
  ELC --> Sel
  EDM --> AC
  PM --> AC
  CI --> AC
  AC --> TSvc
  AC --> DM
  AC --> EH
  AC --> UNI & SHSG
  raw --> UNI
  DM --> CDN
```

Main flows:

- **Startup.** `AuthProvider` acquires a token into `authTokenState`. `useTermSelection` loads the term list (raw axios), initializes one semester entry per term, validates the primary term by fetching its enrolments (raw axios), synthesizes up to two projected future semesters, and selects the latest valid term.
- **Browse a semester.** `useEventListDataManager` fans out to four hooks that fetch catalog, enrolments, wishlist and ratings for the selected semester and write them into `unifiedCourseDataState` through `useUnifiedCourseData`. Three effects then call `updateFilteredCourses`, which materializes the `filtered` array in the atom. `EventListContainer` renders `filtered` (or smart-search results) with react-window.
- **Wishlist toggle.** `useCourseSelection` updates `selectedIds` and `filtered` in the atom, writes two legacy atoms, then calls the SHSG study-plan endpoint (up to three DELETEs on removal).
- **Curriculum map.** `usePlanManager` loads plans once, each drop is one POST, and the server response replaces local plan state (no optimistic update). `curriculumMapSelector` merges scorecard categories, transcript courses, wishlist and plan placements into a grid.
- **Academic data.** Two bootstrap hooks fetch enrolments and one scorecard per programme, transform, and replace `unifiedAcademicDataState` wholesale.

---

## 3. Strengths

Patterns worth keeping and extending, with where to look.

- **HTTP and session resilience** (`helpers/axiosClient.js`, `auth/tokenService.js`, `common/AppStateProvider.jsx`). One singleton with request and response interceptors; exponential backoff with jitter; 401 handling with a refresh queue and a three-strikes escalation; a single-modal precedence rule (expired > renew > offline). `ERROR_HANDLING.md` documents the flow and the knobs. 513 lines of tests on the client alone.
- **Degraded-mode kill switch** (`helpers/degradedModeService.js`, ADR 0001, `docs/KILLSWITCH.md`). Fail-open polling of a static file with a generation token that makes restart and stop race-free; enforcement at the interceptor rather than in each feature; a resilience test suite. The design and the runbook are exemplary and should be the template for future operational toggles.
- **Tab model** (`constants/tabs.js`, `pages/tabSelectHandler.js`, `helpers/useOpenCourseDetails.js`). Ids instead of indices, a single source of order, conversion at the react-tabs boundary only, and one encapsulated "open course details" action that also emits the analytics event.
- **Exam schedule pipeline** (`scripts/ingest-exam-plan/`, `recoil/examScheduleAtom.js`, ADRs 0010 to 0012). Offline ingestion with golden-file tests, a `schemaVersion` check at runtime, static per-semester JSON, an `atomFamily` effect that loads once per semester, and a `_redirects` rule that turns the SPA fallback into a real 404 for missing plans. This is the cleanest data path in the app.
- **Documented invariants.** `REFERENCE_SEMESTER.md` explains the borrowed-catalog rule and the regression it prevents; the guard lives in one place (`similarCoursesApi.js`). ADRs 0006 to 0012 are recent, specific and tied to tests.
- **Pure helper extraction.** `courseUtils.js`, `examScheduleUtils.js`, `programEraScope.js`, `clearSavedCourses.js`, `calendarEntriesSelector.js` (union-find for collision groups), and `curriculumMapSelector.js` exposing `_testHelpers`. `curriculumMapSelector` has an 1118-line test file. Continue moving logic out of hooks and components into such modules.
- **Server-authoritative curriculum plans** (`helpers/usePlanManager.js`, `helpers/curriculumPlansApi.js`). Every mutation is one placement-level request and the response replaces local state. Predictable and easy to reason about.
- **Test infrastructure** (`src/test/setup.js`, `src/test/mocks/`). MSW with an error-mode switch, no network in unit tests, colocated `__tests__` folders, and CI that runs lint with zero warnings, tests and a production build.

---

## 4. Findings

Severity: High / Medium / Low. Timing: now / as the system grows / later. Effort: S (hours to a day) / M (days) / L (a week or more, incremental).

### 4.1 Cleanliness and maintainability

#### C1. University-API calls bypass `apiClient` and its resilience logic

- **Severity:** High. **Timing:** now.
- **What and where.** Five call sites make outbound requests without the singleton:
  - `helpers/useCourseInfoData.js:55` (raw `axios.get`, the per-semester catalog, the largest payload in the app)
  - `helpers/useCurriculumMapCourseLoader.js:80` (raw `axios.get`, same endpoint)
  - `helpers/useUnifiedCourseLoader.js:116` (`fetch`, same endpoint, errors swallowed in an empty `catch`)
  - `helpers/useTermSelection.js:133` and `:208` (raw `axios.get`, term list and primary-term enrolments)
  - `helpers/useEnrolledCoursesData.js:61` (raw `axios.get`)

  Each repeats the `X-ApplicationId` header literal (7 occurrences in `src/`). `CLAUDE.md` states "All requests flow through the singleton `apiClient`".
- **Why it matters.** These requests get no timeout, no retry with backoff, no 401 refresh and no offline detection. After a token expires, the catalog fetch fails once and `ErrorHandlingService` shows a toast; the retry queue that exists for everything else never runs. The kill switch is unaffected because these hosts are not SHSG, but the documented contract is false.
- **Possible approaches.**
  - A. Replace each call with `apiClient.get(url, authToken, { headers })`. Mechanical; the only behaviour change is that the retry and 401 paths start applying. Add an ESLint `no-restricted-imports` rule for `axios` outside `axiosClient.js`.
  - B. In addition to A, add one `universityApi.js` module next to `api.js` and `curriculumPlansApi.js` so endpoints and headers live in one place.
- **Affected.** The five files above, `axiosClient.js` (unchanged), `.eslintrc.cjs`.
- **Effort:** S. **Confidence:** verified.

#### C2. Academic-data bootstrap is duplicated and writes the atom from two places

- **Severity:** Medium. **Timing:** now.
- **What and where.** `helpers/useInitializeScorecards.js:77-139` and `helpers/useScorecardFetching.js:124-186` contain the same ~60-line transform (`findMainProgram`, `buildTranscriptView`, `buildStudyOverviewView`, `calculateProgramStats`, programme-type inference by substring) and both end with a whole-object `setUnifiedAcademicData({ programs, currentProgram, initialization })`. `Transcript.jsx:39,59` and `CurriculumMap/CurriculumMap.jsx:21-22` mount both. `CLAUDE.md` says both "build their program map with the shared `helpers/buildAcademicPrograms.js`"; that file does not exist on `dev`. `Transcript.jsx:343-346` additionally calls `handleFetchIfNeeded()` during render.
- **Why it matters.** A change to how a programme is classified must be made twice. The two paths can race on first load and the later writer wins, discarding whatever the other produced. A render-time side effect runs twice under StrictMode and is the kind of code React 19 will make harder to keep.
- **Possible approaches.**
  - A. Extract `buildAcademicPrograms(rawScorecards, mainStudyLookup, unifiedCourseData)` as the doc already describes; have both hooks call it. Then make `useInitializeScoreCards` a thin wrapper around `fetchAll` so there is one fetch path with one in-flight guard.
  - B. Go further and move the fetch into a Recoil selector family or a small async loader keyed by `authToken`, so components only read.
- **Affected.** The two hooks, `Transcript.jsx`, `CurriculumMap.jsx`, `StudyOverview.jsx`, `SimilarCourses.jsx`, `useSmartSearch.js`.
- **Effort:** S to M. **Confidence:** verified.

#### C3. Legacy state still live under the "complete" unified migration, plus dead modules

- **Severity:** Medium. **Timing:** now (it misleads), grows (every feature inherits it).
- **What and where.**
  - `localSelectedCoursesSemKeyState` is read by `curriculumMapSelector.js:804`, `unifiedAcademicDataSelectors.js:40` and `CurriculumMap/CoursePicker.jsx:101`, but it is only written by user clicks in `useCourseSelection.js:128-158`. The server wishlist loaded in `useStudyPlanDataSimplified.js` never populates it, so these consumers see only this session's clicks.
  - `localSelectedCoursesState` is written in `useCourseSelection.js:99-124` keyed by `index`, which `EventListContainer.jsx:229-234` never passes, so entries accumulate under the key `"undefined"`. Nothing reads it.
  - `useUnifiedSemesterState.js:79-81,121-123,152-154` writes `enrolled` and `selected` keys into semester entries; the schema uses `enrolledIds` and `selectedIds`. `updateSemesterCourses` (`:186-190`) rebuilds the object without `selectedCourseInfo`, which would clear the open course if it were ever called. Neither `updateSemesterCourses` nor `setFutureSemesterStatus` has a caller.
  - `scorecardDataState` duplicates `unifiedAcademicDataState` ("LEGACY: keep populated"), `selectedCourseIdsAtom` is used only by `Transcript.jsx`.
  - No importer in app code: `helpers/unifiedDataTransforms.js` (260 lines), `recoil/referenceSemesterAtom.js`, `recoil/ApiScorecardEnrollments.jsx`, `helpers/demoTestFunction.js`, `helpers/createSemesterMap.js`. In `useUnifiedCourseData.js:167-192`, `logReferenceSemesterChange` and `validateReferenceInvariant` compute values and return nothing.
  - Dependencies with no usage in `src/`: `bootstrap`, `react-bootstrap`, `@tailwindcss/line-clamp` (not registered in `tailwind.config.js`; the one `line-clamp-` class is covered by Tailwind 3.3+ core).
- **Why it matters.** The curriculum map and study overview show a different wishlist than the course list after a reload until the user clicks something. New contributors cannot tell which atom is authoritative. Dead writes cost allocations on every toggle.
- **Possible approaches.**
  - A. Replace the three `localSelectedCoursesSemKeyState` reads with `semesterCoursesSelector({ semester, type: "selected" })` or `myCoursesSelector`, then delete both local-selected atoms and the two writes in `useCourseSelection`.
  - B. Delete the unused modules and dependencies, and remove `useUnifiedSemesterState`'s unused functions, in one cleanup PR.
- **Affected.** `useCourseSelection.js`, `curriculumMapSelector.js`, `unifiedAcademicDataSelectors.js`, `CoursePicker.jsx`, `useUnifiedSemesterState.js`, `package.json`, the dead files.
- **Effort:** S for B, M for A. **Confidence:** verified.

#### C4. Project documentation describes code that is not on `dev`

- **Severity:** Medium. **Timing:** now.
- **What and where.** `CLAUDE.md` references `rightCol/transcript/`, `helpers/transcript/buildTranscriptModel.js`, `helpers/useGradesHidden.js`, ADR 0005, `helpers/buildAcademicPrograms.js`, `useStudyPlanData.js`, `src/test/e2e/` and `src/test/migration/`. None exist on `dev` (lines 215, 279, 294 and the "Helper Hook Pattern" section). It also tells new code to avoid `legacyAcademicDataSelector` while `Transcript.jsx:11` uses it. `README.md` says testing is "COMING SOON" although there are 989 tests. `docs/adr/` skips numbers 0002, 0003 and 0005.
- **Why it matters.** `CLAUDE.md` is the operating manual for both humans and coding agents. An agent asked to touch the transcript will look for a model layer that does not exist, or build on one that lives on an unmerged branch (`feature/transcript-overhaul`).
- **Possible approaches.**
  - A. Rewrite the stale sections to match `dev`, and note which items live on which branch. Add the missing ADR numbers or renumber.
  - B. Add a CI check that every path mentioned in backticks in `CLAUDE.md` exists.
- **Affected.** `CLAUDE.md`, `README.md`, `docs/adr/`.
- **Effort:** S. **Confidence:** verified.

#### C5. Very large modules with mixed responsibilities

- **Severity:** Medium. **Timing:** as the system grows.
- **What and where.**
  - `recoil/curriculumMapSelector.js` (1391 lines): one selector body spans lines 799 to 1307 and performs key collection, grid initialization, four placement passes, credit aggregation and programme statistics.
  - `helpers/usePlanManager.js` (1016 lines): fifteen `useRecoilCallback`s, each repeating the registry read, API call, response-to-state conversion and toast.
  - `helpers/useUnifiedCourseData.js` (803 lines): 90 lines of console-logging helpers (`:43-129`), 25 closures recreated on every render, 7 alias exports (`:776-802`), and two no-op validators.
  - `rightCol/SimilarCourses.jsx` (607 lines) and `helpers/useSmartSearch.js` duplicate programme derivation (`SimilarCourses.jsx:79-87` and `useSmartSearch.js:64-70`) and the empty-result upsert-then-retry sequence, including an 800 ms `setTimeout` retry loop (`SimilarCourses.jsx:249-253`).
- **Why it matters.** Changes to grid placement rules require reading 500 lines to find the right pass. A new plan operation means copying 40 lines. The logging helpers run on every write in production.
- **Possible approaches.**
  - A. Split `curriculumMapSelector` into per-pass pure functions (`placeCompleted`, `placeWishlist`, `placeEnrolled`, `placePlanned`, `aggregateCredits`) that the selector composes. The existing `_testHelpers` and test file make this safe.
  - B. In `usePlanManager`, factor a `withActivePlan(async (planId, token) => apiCall)` helper that handles registry read, error toast and `convertPlacementsToPlannedItems`.
  - C. Extract the shared smart-search/similar-courses query orchestration into one hook that both consumers call with a different result sink.
- **Affected.** The four modules above.
- **Effort:** M. **Confidence:** verified.

#### C6. Logging and error-reporting hygiene

- **Severity:** Low to Medium. **Timing:** now.
- **What and where.** 260 `console.*` calls in non-test source. `useUnifiedCourseData.js` logs a group on every semester init and every filter run; `useStudyPlanDataSimplified.js` logs the full study-plan payload (`:71`). `ErrorHandlingService.jsx:130-154` logs `error.config.data` (the request body) at `console.error` in production; for the custom-grades endpoint that body contains a grade. `axiosClient.js:281` logs every retry. `CLAUDE.md` asks for structured logs with no PII.
- **Why it matters.** Production consoles are noisy, which hides real errors, and personal data reaches browser logs and any screenshot a user sends with a bug report.
- **Possible approaches.**
  - A. Add a 20-line `log.js` (`debug`, `info`, `warn`, `error`) where `debug` and `info` are no-ops unless `import.meta.env.DEV`; replace `console.log` by search and replace. Redact `data` and `params` in `errorDetails` unless DEV.
- **Affected.** ~40 files mechanically; `ErrorHandlingService.jsx`.
- **Effort:** S. **Confidence:** verified.

#### C7. Minor items (grouped)

- `app/index.html:2-3` closes `</html>` before `<head>`. Browsers recover, but validators and some tooling will not.
- `rightCol/SemesterSummary.jsx:37` carries a TODO describing a reactivity bug and a "fake overlap" that is "also on current prod".
- `rightCol/CourseInfo.jsx:142-144` hard-codes a course number to drop from ratings.
- `rightCol/CourseInfo.jsx:430-468` renders six API HTML fields with `dangerouslySetInnerHTML` and no sanitizer. The source is the university's own API, so the risk is low, but a DOMPurify pass is cheap.
- 16 `eslint-disable-next-line react-hooks/exhaustive-deps` directives, concentrated in the data hooks. Each is a place where the dependency graph is managed by hand.
- **Effort:** S each. **Confidence:** verified.

### 4.2 Performance

#### P1. Virtualized row component is declared inside the list's render function

- **Severity:** High. **Timing:** now.
- **What and where.** `leftCol/bottomRow/EventListContainer.jsx:238` defines `const Row = ({ index, style, data }) => { ... }` inside `EventListContainer`. React treats a new function identity as a new component type, so every render of the container unmounts and remounts every visible row, including each row's `useDraggable` registration. The container re-renders on every keystroke in the search box (via `selectionOptionsState`), on every write to `unifiedCourseDataState` (via `useUnifiedCourseData()` at `:87`, used only for dev logging), and on exam and smart-search selector changes. `LoadingRow` and `NoCoursesRow` have the same problem but render once.
- **Why it matters.** This is the most frequently rendered surface in the app. Remounting 10 to 15 rows with drag registration on each keystroke is measurable on mid-range phones, and it discards row-level DOM state (tooltip anchors, focus).
- **Possible approaches.**
  - A. Move `Row` to module scope (it already receives everything through `data`). Wrap it in `React.memo` and pass `itemData` through `useMemo`. Remove the `useUnifiedCourseData()` call from the container and derive the dev-logging counts from the selectors already subscribed.
- **Affected.** `EventListContainer.jsx`.
- **Effort:** S. **Confidence:** verified by code reading; the magnitude on real devices has not been profiled.

#### P2. Whole-atom subscriptions, unmemoized writers and derived state stored in the atom

- **Severity:** Medium to High. **Timing:** now, and grows with the number of loaded semesters.
- **What and where.**
  - `helpers/useUnifiedCourseData.js:201` uses `useRecoilState(unifiedCourseDataState)`. Thirteen call sites invoke this hook, eight of which only need setters (`useCourseInfoData`, `useStudyPlanDataSimplified`, `useCourseRatingsData`, `useEnrolledCoursesData`, `useOpenCourseDetails`, `useCurriculumMapCourseLoader`, `useUnifiedCourseLoader`, `useCourseSelection`). Each host re-renders on any change to any semester.
  - The 25 returned functions are plain closures, so they change identity every render. `useCurriculumMapCourseLoader.js:133-139` and `useUnifiedCourseLoader.js:143` list them as effect dependencies, so those effects re-run on every host render and rely on refs or state sets to avoid refetching.
  - `filtered` is derived from `available`, `ratings`, `enrolledIds` and `selectedIds` but is stored in the atom. `useEventListDataManager.js:96-115` and `:118-141` both call `updateFilteredCourses` with overlapping dependencies, and `addSelectedCourse`/`removeSelectedCourse` patch `filtered` by hand. Each run copies every course object (`:612-637`) and does `includes` on id arrays.
  - `updateCourseRatingsForAllSemesters` (`:551-567`) writes the same ratings map into every semester, so one ratings response produces a change for every semester entry.
  - `useCurriculumMapCourseLoader` loads a catalog for every semester the map shows, so after one visit to the map the atom holds ~10 catalogs; every subsequent write spreads all of them.
- **Why it matters.** Re-render fan-out and copy volume scale with semesters × courses. The symptoms are typing lag in the search box and stutter while the map loads. The hand-maintained `filtered` is also a source of the reactivity bug noted in `SemesterSummary.jsx:37`.
- **Possible approaches.**
  - A. (Small, immediate) Split `useUnifiedCourseData` into `useUnifiedCourseDataWriters()` built on `useSetRecoilState` with `useCallback`, and keep the reading hook for the two or three places that need the value. Most hosts stop re-rendering.
  - B. (Medium) Turn `filtered` into a `selectorFamily` keyed by semester that reads `available`, `ratings`, the id lists and `selectionOptionsState`. Delete `updateFilteredCourses`, both effects, and the `filtered` patches in add/remove. `smartSearchResultsSelector` already shows the pattern.
  - C. Store ratings once at top level instead of per semester; `lookupCourseRating` already takes the map as an argument.
- **Affected.** `useUnifiedCourseData.js`, `useEventListDataManager.js`, `unifiedCourseDataSelectors.js`, `EventListContainer.jsx`, the eight setter-only hooks.
- **Effort:** S for A, M for B and C. **Confidence:** verified by code reading; render counts not measured.

#### P3. Duplicate and chatty I/O

- **Severity:** Medium. **Timing:** now on slow networks, more during peak weeks.
- **What and where.**
  - The catalog endpoint `CourseInformationSheets/myLatestPublishedPossiblebyTerm/{cisId}` is fetched by three hooks with three independent dedupe mechanisms: `useCourseInfoData.js:55` (effect per selected semester), `useCurriculumMapCourseLoader.js:80` (per-hook `attemptedRef`), `useUnifiedCourseLoader.js:116` (per-instance `loadedSemesters` state; `Transcript` and `StudyOverview` each mount their own instance). The only shared guard is `available.length > 0`, which is false while a fetch is in flight.
  - `MyCourses/byTerm/{id}` for the primary term is fetched twice at startup: `useTermSelection.js:208` (header language DE) and `useEnrolledCoursesData.js:61` (EN).
  - `GET /study-plans` returns all semesters, but `useStudyPlanDataSimplified.js:64` refetches it on every semester switch (`:195-200` depends on `selectedSemester.id`).
  - Removing a wishlist course issues up to three sequential DELETEs (`useCourseSelection.js:186-201`) to cover historical id formats.
  - `CourseInfo.jsx:86-92` and `:163-175` refetch the course sheet and ratings on every selection with no cache; the sheet call retries with a second id on failure.
  - `switchPlan`, `createPlan` and `duplicatePlan` each upsert the whole current plan before the requested operation (`usePlanManager.js:192, 246, 305`).
- **Why it matters.** The catalog payload is the largest request in the app. During intro week the university API is the slow component, and each duplicate competes with the request the user is waiting for. The kill switch exists because SHSG load is a known problem; the per-switch study-plan refetch and the triple delete add to exactly that load.
- **Possible approaches.**
  - A. One `loadCatalog(semesterKey)` function in a `catalogLoader.js` module with a module-level `Map<cisId, Promise>` for in-flight requests and the reference-fallback logic in one place. All three hooks call it. This also removes the three copies of the sparse-term fallback.
  - B. Load `/study-plans` once per session (it already updates every semester), and invalidate on wishlist mutation.
  - C. Drop the enrolments fetch from `useTermSelection` (it only validates the term) or have `useEnrolledCoursesData` skip when `enrolledIds` is already populated for that term.
  - D. Add a small per-session cache (`Map<courseNumber, sheet>`) in `CourseInfo` or a selector family.
- **Affected.** The hooks named above.
- **Effort:** M. **Confidence:** duplicate catalog fetch is a race window (suspected; confirm with the network panel while switching to the map during load); the others are verified from code.

#### P4. Single 1.5 MB JavaScript bundle, no code splitting

- **Severity:** Medium. **Timing:** now on mobile.
- **What and where.** `dist/assets/index-CiE7ppdP.js` is 1,485,647 bytes uncompressed (build of `ba8c8b0`, 2026-10-31). `vite.config.js` has no `manualChunks`, and no `React.lazy` is used; FullCalendar (three packages), dnd-kit, MSAL, react-select, react-tooltip and the curriculum map all load before login renders.
- **Why it matters.** Users on phones in the field (the mobile work in the changelog shows this matters) download and parse everything to see the login page. Compressed size was not measured and is likely a third of that, but parse time is paid on the uncompressed size.
- **Possible approaches.**
  - A. `React.lazy` for the right-column panels in `TAB_PANEL_CONTENT` (they are already wrapped in `Suspense`), and for `Login` versus `Biddit2`.
  - B. `build.rollupOptions.output.manualChunks` for `@fullcalendar/*`, `@azure/*`, `@dnd-kit/*`. Add a size check to CI.
- **Affected.** `pages/TabComponent.jsx`, `App.jsx`, `vite.config.js`.
- **Effort:** S to M. **Confidence:** size verified; impact on load time not measured.

### 4.3 Expandability

#### E1. No normalized domain model at the API boundary

- **Severity:** High. **Timing:** now, and it gets worse with every feature.
- **What and where.** Raw API objects are stored as received and every consumer re-derives the basics:
  - **Course identity.** `courseUtils.js:21-44` tries six properties in order. `useCourseSelection.js:71-75` checks four candidates with `includes`; `:186-201` deletes under three ids. `curriculumMapSelector.js:883-888` matches on `courseNumber === id || id === id || courseNumber === courseNumber`. `unifiedAcademicDataSelectors.js:362-366` compares three id pairs.
  - **Credits.** Two units coexist ("cents", 300 = 3 ECTS, and ECTS). The `> 99` or `/ 100` heuristic appears in 11 files: `useCourseSelection.js:13-19`, `curriculumMapSelector.js:34-37`, `pages/Biddit2.jsx:27-31`, `unifiedAcademicDataSelectors.js:101`, `academicDataTransformers.js`, `SemesterSummary.jsx`, `SimilarCourses.jsx`, `CourseInfo.jsx`, `EventListContainer.jsx`, `SelectEcts.jsx`, `unifiedDataTransforms.js`. `DragPreviewCard` needs a flag to know which unit it received.
  - **Semester keys.** Normalization of `"FS 25"` to `"FS25"` is defined three times (`curriculumMapSelector.js:22`, `useCurriculumMapCourseLoader.js:35`, `courseSelection.js:8`). Same-season-previous-year is computed in `useUnifiedCourseData.js:176-184`, `useUnifiedSemesterState.js:12-20` and `useTermSelection.js:91-93,316-319`. Season parsing by `slice(0, 2)` appears in eight files.
  - **"Current semester".** Three definitions that can disagree: the API `isCurrent` flag (`studyOverviewHelpers.js:14-17`, `currentSemesterSelector`), a calendar heuristic where FS is February to May (`curriculumPlanAtom.js:191-192`, used by `useTermSelection.js:180` and the whole curriculum map), and a second calendar heuristic in the same file where FS is February to July (`curriculumPlanAtom.js:104-106`). In June, the map says HS while `generateFutureSemesters` says FS.
- **Why it matters.** Adding a data type (for example, a second catalog source or a new course attribute) means touching every consumer. Bugs of the "wishlist shows in the list but not in the map" family come from two consumers resolving identity differently. The triple delete exists only because the write side never normalized the id.
- **Possible approaches.**
  - A. (Recommended, incremental) Create `src/domain/` with `course.js` (`normalizeCourse(raw) -> { id, courseNumber, rootKey, shortName, ects, classification, lecturers, calendarEntry, raw }`), `credits.js` (`toEcts`, `formatEcts`), and `semester.js` (`normalizeKey`, `parse`, `compare`, `previousYearSameSeason`, `currentSemester(date)`). Apply `normalizeCourse` once in `updateAvailableCourses` and in the enrolment and study-plan loaders. Replace heuristics file by file; each replacement is small and testable. Decide which "current semester" rule is authoritative and delete the other two.
  - B. Add JSDoc typedefs (or move these modules to TypeScript) so the normalized shape is visible at call sites.
- **Affected.** `useUnifiedCourseData.js` (entry point), then the 11 credit sites, the identity sites, the semester helpers, `curriculumPlanAtom.js`.
- **Effort:** L in total, delivered as a series of S and M steps. **Confidence:** verified.

#### E2. State library at end of life

- **Severity:** High. **Timing:** later, but the exit price rises with every atom.
- **What and where.** `recoil@0.7.7`; the last publish on npm is 2024-02-12 and the upstream repository is archived. `App.jsx:66-69` already disables React Router's transitions because "Recoil 0.7 does not support concurrent rendering". About 40 files in `components/recoil/` define atoms and selectors, and `examScheduleAtom.js` uses `getInfo_UNSTABLE`.
- **Why it matters.** React 19 and concurrent features are closed off. Security patches for the dependency will not come. The selector graph (`curriculumMapSelector` depends on four atoms through two levels) is the hardest part to move.
- **Possible approaches.**
  - A. Jotai: closest API (atoms, derived atoms, `atomFamily`), supports concurrent rendering, incremental coexistence is possible. Selectors become derived atoms.
  - B. Server state to TanStack Query (catalog, enrolments, study plans, scorecards, curriculum plans all fit: keyed, cached, deduplicated in flight, which also resolves most of P3), with a small Zustand or Jotai store for the remaining client state (selected semester, filters, tab, plan edits).
  - C. Stay on Recoil and accept React 18 for the product's remaining life. Reasonable only if the horizon is short.

  Any of these is easier after E1 and P2 (B), because fewer places will touch raw state.
- **Affected.** Everything under `components/recoil/`, all hooks.
- **Effort:** L. **Confidence:** verified for the facts; the choice is a product decision.

#### E3. Environment and tenant configuration is hard-coded

- **Severity:** Medium. **Timing:** as deployment targets grow.
- **What and where.** `auth/authConfig.js:15-23` embeds the Entra client id and tenant id and picks the redirect URI by `window.location.hostname` with three literal hosts. The university `X-ApplicationId` appears seven times. API hosts are string literals in every call site (`api.shsg.ch` in 11 files, `integration.unisg.ch` in 9). `axiosClient.js:9` hard-codes `SHSG_HOST` for the kill switch. No `.env` files or `VITE_*` variables exist.
- **Why it matters.** A preview deployment, a staging backend, or a second university tenant each requires code edits in several files and a rebuild per environment.
- **Possible approaches.**
  - A. `src/config.js` reading `import.meta.env.VITE_*` with the current literals as defaults; `redirectUri: window.location.origin + "/"` removes the hostname switch entirely. `isShsgHost` compares against the configured host.
- **Affected.** `authConfig.js`, `axiosClient.js`, the API modules.
- **Effort:** S. **Confidence:** verified.

#### E4. Token plumbing through every signature

- **Severity:** Medium. **Timing:** as the system grows.
- **What and where.** `authTokenState` is read in 17 files and `authToken` is a parameter of every API function and every data hook (`api.js`, `curriculumPlansApi.js`, `similarCoursesApi.js`, `useEventListDataManager`, `useUnifiedCourseLoader`, ...). `apiClient.get(url, token, config)` takes the token positionally. `tokenService.getRefreshToken` already knows how to obtain one from MSAL.
- **Why it matters.** Every new endpoint or hook repeats the plumbing, and the hooks cannot start until the atom is populated, which is why several of them guard on `authToken &&` and re-run when it changes.
- **Possible approaches.**
  - A. Have the request interceptor attach `Authorization` from `msalInstance.acquireTokenSilent` (cached by MSAL) when the caller did not pass one. Keep the explicit parameter for tests. Remove the parameter from new code and migrate old call sites opportunistically.
- **Affected.** `axiosClient.js`, `tokenService.js`, then call sites.
- **Effort:** M. **Confidence:** verified.

#### E5. Curriculum-map category resolution is keyword-driven

- **Severity:** Medium. **Timing:** as programmes and languages grow.
- **What and where.** `curriculumMapSelector.js:63-153` maps scorecard category titles to classifications by German and English keyword lists (10 patterns plus an "elective but not Wahlpflicht" special case). ADR 0007 documents the approach and the test file covers it.
- **Why it matters.** A new programme whose scorecard uses different wording, or a third language, means editing the pattern table in a 1391-line file and adding tests. This is acceptable today because the programme set is small; it will not stay acceptable if the map becomes the primary planning surface.
- **Possible approaches.**
  - A. Move the pattern table to a data file (`domain/categoryPatterns.json`) consumed by the same code, so additions are data edits with their own tests.
  - B. Ask the backend to expose a classification-to-category mapping per study regulation, and keep the heuristics as fallback.
- **Affected.** `curriculumMapSelector.js`.
- **Effort:** S for A. **Confidence:** verified.

#### E6. Test coverage gaps on the orchestration hooks that the refactors above will touch

- **Severity:** Medium. **Timing:** now, because E1 and P2 need a safety net.
- **What and where.** No test file mentions `useTermSelection` (383 lines, startup sequencing), `useCourseInfoData` (sparse-term fallback), `useEnrolledCoursesData`, `useUnifiedSemesterState`, `useUnifiedAcademicData`, `useSmartSearch`, `SimilarCourses.jsx`, `GradeTranscript.jsx`, `CurriculumGrid.jsx` or `useAcademicProgress`. By contrast, the pure modules and the resilience layer are well covered (`usePlanManager` 944 test lines, `curriculumMapSelector` 1118, `axiosClient` 513, `degradedModeService` 386). The `coverage/` directory on disk is from January and no coverage threshold is enforced in CI.
- **Why it matters.** The startup sequence (term list, primary term, projected semesters, reference resolution) is the most intricate flow in the app and has no regression protection.
- **Possible approaches.**
  - A. Add MSW-backed tests for `useTermSelection` and `useCourseInfoData` before touching them (the fixtures already exist under `src/test/mocks/`). Add `npm run coverage` to CI with a floor on `helpers/`.
- **Affected.** `src/components/helpers/__tests__/`, `.github/workflows/ci.yml`.
- **Effort:** M. **Confidence:** verified (presence of test files), coverage numbers not measured.

---

## 5. Prioritized recommendations

**Now (quick wins, each under a day)**

1. Hoist `Row`, `LoadingRow` and `NoCoursesRow` to module scope and memoize `itemData` (P1).
2. Route the five raw `axios`/`fetch` calls through `apiClient` and add the ESLint restriction (C1).
3. Split `useUnifiedCourseData` into setter-only and reader hooks with `useCallback` (P2 A).
4. Correct `CLAUDE.md` and `README.md` to match `dev`; note branch-only features (C4).
5. Extract `buildAcademicPrograms` and collapse the two scorecard bootstraps to one fetch path; remove the render-time fetch in `Transcript` (C2).
6. Delete dead modules, unused dependencies and the two write-only legacy atoms' writes (C3 B).
7. Introduce a DEV-gated logger and redact request bodies from error logs (C6).

**Next (before the next feature cycle, days each)**

8. Start `src/domain/` with `semester.js` and `credits.js`; pick one "current semester" rule; replace the heuristics file by file (E1).
9. Apply `normalizeCourse` at `updateAvailableCourses` and the enrolment and study-plan loaders; then simplify identity checks and the triple delete (E1).
10. Make `filtered` a selector family and delete `updateFilteredCourses` and its effects (P2 B).
11. Consolidate catalog loading into one module with in-flight deduplication; load `/study-plans` once per session (P3).
12. Lazy-load the tab panels and split vendor chunks; add a bundle-size check to CI (P4).
13. Add tests for `useTermSelection` and `useCourseInfoData` before steps 8 to 11 touch them (E6).
14. Replace the three `localSelectedCoursesSemKeyState` reads with unified selectors and delete the atom (C3 A).

**Later (strategic)**

15. Decide the state-library path (E2). The natural sequence is: domain model (E1), server state to a query library (which also closes P3), then the remaining client state to Jotai or Zustand. Each step is independently shippable.
16. Move configuration to `VITE_*` variables and let the client acquire tokens itself (E3, E4).
17. Split `curriculumMapSelector` and `usePlanManager` into composable units and move the category pattern table to data (C5, E5).
18. Retire `StudyOverview`, `GradeTranscript` and the remaining legacy atoms once the transcript overhaul branch lands, as the migration notice already promises.

---

## 6. Open questions

- **Load profile.** What are peak concurrent users during bidding and intro week, and what are the measured response times of the catalog and study-plan endpoints under that load? P3 and P4 are prioritized on the assumption that these are the slow paths.
- **Payload sizes.** How many courses does a full-semester catalog carry, and how large is the JSON? This decides whether P2 is a mild or a severe issue.
- **Transcript overhaul branch.** `CLAUDE.md` describes `feature/transcript-overhaul` as if merged. Is it still planned, and should the review of `Transcript.jsx` be deferred to it?
- **Multi-programme students.** How common is more than one active enrolment? The academic data model handles it, but era scoping (ADR 0008) and `findMainProgram` carry heuristics that only matter in that case.
- **"Current semester" rule.** Which of the three definitions is intended to be authoritative, and does the university API's `isCurrent` flag ever lead the calendar by design?
- **Backend evolution.** Can the SHSG API offer a per-semester study-plan read and a single-id delete, so the client can drop the all-semesters refetch and the triple delete? Can it expose a classification-to-category mapping per study regulation?
- **React 19 and concurrent rendering.** Is upgrading desired within the next year? The answer sets the urgency of E2.
- **Hosting.** `_headers`, `_redirects` and the `dev-biddit.netlify.app` literal suggest Netlify; please confirm, and whether preview deployments per PR are wanted (which E3 enables).
- **Trust boundary for course HTML.** Is the university API content considered trusted for `dangerouslySetInnerHTML`, or should a sanitizer be added as policy?
- **Coverage expectations.** Is a coverage floor in CI acceptable, and at what level for `helpers/` and `recoil/`?
