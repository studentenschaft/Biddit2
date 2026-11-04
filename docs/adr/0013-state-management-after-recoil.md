# ADR 0013: State management after Recoil

- **Status:** Proposed (the user decides; see "Open question" below)
- **Date:** 2026-11-04
- **Finding:** E2 of `docs/architecture-review-2026-11-03.md`, recommendation 15
- **Migration plan:** `docs/superpowers/plans/2026-11-04-state-migration.md`

## Context

The app keeps all client state and the projection of all server data in
`recoil@0.7.7`. The last npm publish is from 2024-02-12 and the upstream
repository is archived, so no fixes will come.

Recoil 0.7.7 cannot run on React 19. Every read hook
(`useRecoilValue`, `useRecoilState`) goes through `useRecoilValueLoadable`,
which evaluates `currentRendererSupportsUseSyncExternalStore()` on each call.
That function destructures `React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED`
(`node_modules/recoil/es/index.js:500-512`, `:5353`). React 19.3.1 exports
only `__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE` and
`__COMPILER_RUNTIME`, so the destructuring throws a `TypeError` on the first
read. Both facts were checked in the package sources; the app was not run on
React 19. Recoil's default hook mode is also declared `concurrent: false`,
which is why `App.jsx` sets `useTransitions={false}` on the router.

The Recoil surface on `architecture-fixes-nov26` at 93341ed:

| Measure | Count |
|---|---|
| Exported state nodes | 92 (40 `atom`, 1 `atomFamily`, 36 `selector`, 15 `selectorFamily`) |
| Production files importing `recoil` | 98 |
| Test files importing `recoil` | 58 (39 of them seed state with `initializeState`) |
| Hook calls in production files | 149 (126 `useRecoilValue`-family reads and writes, 8 `useRecoilCallback`, all in `usePlanManager.js`) |
| `snapshot.getPromise` calls | 13 (all in `usePlanManager.js`) |
| Atom effects | 3 (two telemetry effects, one lazy loader in `examScheduleAtom.js` that uses `getInfo_UNSTABLE`) |
| Async selectors | 3 (`cisIdListSelector`, two in `coursesTakenForRatings.js`) |

Phases 1 and 3 of the architecture-review fix plan already gave the server
reads what a query library would add first: `catalogLoader.js` downloads each
`cisId` once per session and shares in-flight requests, `/study-plans` is read
once per session and invalidated on failed writes, and course sheets and
ratings have a per-session cache (`sessionCache.js`, `courseSheetCache.js`).

## Options

1. **Jotai for all client state.** Atoms, derived atoms and `atomFamily` map
   one to one onto atoms, selectors and selector families. Recoil and Jotai
   can run side by side, so the move can be incremental.
2. **TanStack Query for server state, plus a small client store (Jotai or
   Zustand) for the rest.** Catalogs, study plans, enrolments, scorecards,
   curriculum plans and ratings become keyed queries; the remaining client
   state (selected semester, filters, tab, plan edits) moves to the store.
3. **Stay on Recoil** and keep React 18 for the remaining life of the product.

## Spikes

Both spikes started from 93341ed in their own worktree with their own
dependency install. They are measurement instruments and are not merged.

**Spike A (Jotai)**, branch `spike/jotai` at **b071e36**. Moved
`selectedTabAtom`, `smartSearchState`, `smartSearchResultsSelector` and
`smartSearchActiveSelector` (the last one reads `smartSearchState`, so it has
to move with it) to Jotai 3.0.1, everything else stays on Recoil, and both
providers wrap the app. It also contains, under `src/spike/`, a Jotai version
of `usePlanManager`'s `useActivePlanAction` helper and of `addCourseById`, with
two tests (not wired into the app).

**Spike B (TanStack Query)**, branch `spike/tanstack-query` at **f064c1a**
(its first commit, e709a45, adds the request-count test against the unchanged
code, so the same test measures before and after). Moved the catalog loader
to the query cache (`["catalog", cisId]` for each download, a term-level
query under the same prefix for the reference fallback) and the study-plan
read to `useQuery(["study-plans"])`, with TanStack Query 5.105.3. Recoil keeps
everything else.

Spike B keeps the data where the consumers read it: the query result is
written into `unifiedCourseDataState` by the hook, as before. Switching the
consumers instead would have meant rewriting every selector in
`unifiedCourseDataSelectors.js` and the curriculum-map selectors, because a
Recoil selector cannot read the query cache. That is the smaller change by an
order of magnitude, and it is the one measured.

| Measure | Spike A (Jotai) | Spike B (TanStack Query) |
|---|---|---|
| Diff (excluding `package-lock.json`) | 24 files, +353 / −180 | 11 files, +223 / −274 (ignoring whitespace: +137 / −188) |
| Production source | 15 files, +141 / −118 | 7 files, +213 / −267 |
| Test files edited | 6 files, +69 / −62; one assertion rewritten, none weakened | 3 files (incl. `src/test/setup.js`), +9 / −7; two assertions re-expressed |
| New test files | 1 (proof of the plan-action equivalent, 2 tests) | 1 (cold-start request count) |
| Phase 1/3 loader code | not touched | `catalogLoader.js` 85 → 102, `useCourseInfoData.js` 99 → 51, `useStudyPlanDataSimplified.js` 220 → 177, `studyPlanLoadState.js` 19 → deleted; new `queryClient.js` 16, `studyPlanQuery.js` 23. Net 423 → 369 lines. `sessionCache.js` stays (course sheets use it) |
| Requests on a cold start (catalog + study plans) | n/a | 4 before, 4 after; 4 before, 4 after when the semester is switched away and back |
| Main chunk (`npm run build && npm run check-bundle`) | 647,148 → 655,509 B (+8,361 B; gzip 215.11 → 218.44 kB) | 647,148 → 685,740 B (+38,592 B; gzip 215.11 → 226.72 kB); 14,260 B below the 700 kB budget |
| Library size, minified (own chunk) | `jotai` 8.48 kB (3.66 kB gzip) | `@tanstack/react-query` 38.18 kB (11.55 kB gzip) |
| Full suite (`npx vitest run --testTimeout=10000`) | 115 files, 1137 tests, all pass | 115 files, 1136 tests, all pass |
| Lint | 0 warnings | 0 warnings |

For comparison, `recoil` is 70.63 kB minified (22.40 kB gzip) in its own
chunk; the baseline suite is 114 files and 1135 tests.

### What the spikes showed

- **Cross-library derived state does not exist.** A Jotai atom cannot read a
  Recoil atom, and a Recoil selector cannot read a Jotai atom or the query
  cache. `smartSearchResultsSelector` therefore became a hook
  (`useSmartSearchResults`) that joins `useAtomValue(smartSearchState)` with
  three Recoil selector reads. Each such bridge is temporary code. An
  incremental Jotai migration therefore moves whole connected parts of the
  selector graph. Computed from the `get(...)` calls on 93341ed, 55 of the 92
  nodes form one connected graph around `unifiedCourseDataState`,
  `unifiedAcademicDataState` and `curriculumPlanState` (18 defining files,
  including the curriculum-map, academic, exam-schedule and filter-list
  selectors); it has to switch libraries in one step. The other nodes are
  leaves read only by hooks, plus two small graphs (the curriculum-plan
  registry with its two selectors, and the ratings prompt with the auth token).
- **Atom effects have no Jotai counterpart, but the telemetry effect has a
  direct replacement.** A write-through atom (a private value atom plus a
  writable derived atom that calls `trackTabSelect`) passes the unchanged
  telemetry tests, including "does not double-count under StrictMode". The
  exam-plan loader effect, which relies on `getInfo_UNSTABLE(node).isSet`,
  needs its own design (an `atomFamily` of async atoms, or `onMount`).
- **`useRecoilCallback` has a clean equivalent.** `useAtomCallback(useCallback(
  async (get, set, ...args) => ..., deps))` replaces it line for line, and
  `await snapshot.getPromise(atom)` becomes `get(atom)`. One semantic
  difference: a Recoil snapshot is frozen at call time, while Jotai's `get`
  returns the live value, also after an `await`. The eight
  `useActivePlanAction` call sites read once, before their request, so they
  behave the same; `switchPlan`, `createPlan`, `duplicatePlan` and
  `importSelectedCourses` read more than once and need review.
- **Selector families have a clean equivalent, with one exception.** Of the
  12 `selectorFamily` definitions in `unifiedCourseDataSelectors.js`, 11 take
  a semester string and become `atomFamily((semester) => atom((get) => ...))`
  directly. `semesterCoursesSelector({ semester, type })` takes an object;
  Recoil compares parameters by value, Jotai's `atomFamily` by `Object.is`,
  so each render would create a new atom. It needs a deep `areEqual` or a
  string key. In Jotai 3, `atomFamily` is no longer in the core package and
  comes from `jotai-family`.
- **Tests need a store per test.** Without a `Provider`, Jotai uses one default
  store per module graph, so state leaks between the tests of one file. The
  edited tests wrap their tree in `<Provider>` or seed a `createStore()` with
  `store.set`, which replaces `initializeState`.
- **TanStack Query does not reduce the request count here.** The Phase 1 and
  3 loaders already give one request per catalog and per study-plan read in a
  session, and the query cache reproduces that number exactly. What it
  removes is lifecycle code: the `useState` loading flags, the cancel guards,
  the `loaded`/`version` atom and the module `Map`.
- **The query cache adds a second copy of the data path while Recoil
  remains.** The hook copies the query result into the Recoil atom in an
  effect, so `isLoading` turns `false` one render before the atom holds the
  courses. No test caught a regression, but a brief empty list is possible.
- **A returned promise broke unrelated tests.** `queryClient.invalidateQueries`
  returns a promise. While `useInvalidateStudyPlan` returned it, the test that
  calls `act(() => invalidate())` turned that `act` into an unawaited async
  scope, and the next two tests in the file never rendered. The fix was to
  return nothing. The same trap applies to any callback that tests wrap in a
  synchronous `act`.
- **Jotai 3 requires Node 22.12 or later.** CI uses `node-version: 22`, which
  resolves to a recent 22.x; `package.json` still declares `node >= 20`.

## Comparison of the options

| | 1. Jotai | 2. TanStack Query + client store | 3. Stay on Recoil |
|---|---|---|---|
| Migration size | All 92 nodes, 149 hook calls, 58 test files. Spike A moved 4 nodes and 12 hook calls with +210 / −180 changed lines in source and tests; extrapolated, 2,000 to 5,000 changed lines over about 100 production and 58 test files, in 4 to 5 phases | Option 1's client-store migration for everything that is not server state, plus about 9 server-state sources (2 done in Spike B, at about 150 changed source lines each when whitespace is ignored). Larger than option 1 in total | None |
| Risk | Medium: mechanical per call site, but one large step: the 55-node connected graph (about 75 production and 45 test files) switches at once; the exam-plan effect and four `usePlanManager` callbacks need care | Higher: two libraries to introduce, the projection pattern (query cache copied into the store) until consumers switch, invalidation and `act` subtleties | Low now, rising: no fixes, and the first dependency that requires React 19 forces an unplanned migration |
| React 19 and concurrent rendering | Unblocks both once Recoil is removed; Jotai 3 declares `react >= 18` | Unblocks both once Recoil is removed; TanStack Query 5 declares `react ^18 \|\| ^19` | Blocked: Recoil throws on React 19; router transitions stay off |
| Bundle at the end | about −62 kB minified (−70.6 kB Recoil, +8.5 kB Jotai) | about −24 kB with Jotai as the store (−70.6, +38.2, +8.5); Zustand not measured | unchanged |
| Server-request behaviour | unchanged (Phase 1/3 loaders stay) | unchanged in count; adds invalidation, background refetch and devtools as options | unchanged |
| Maintenance outlook | Active (3.0.1 on 2026-09-29; the 2.x line still patched, 2.20.3 on 2026-08-24) | Active (5.105.3) plus the store's outlook | Archived upstream; no further releases |

## Decision (recommendation)

**Assumption:** a React 19 upgrade is wanted within the next twelve months.
The review's open question "is upgrading desired within the next year?" has
not been answered.

Under that assumption, **option 1: move all client state to Jotai**, bottom-up
through the dependency graph as laid out in the migration plan, and keep the
Phase 1/3 loaders for server reads. Spike B shows that TanStack Query would
not reduce requests in this codebase today, adds 38.6 kB to the main chunk
while Recoil remains, and, as long as the selectors stay in a client store,
only replaces the loaders' lifecycle code while adding a second data path.
Option 1 removes the React 19 blocker with the smaller total change and ends
with a smaller bundle.

TanStack Query stays a later option, independent of this decision: once all
client state is in Jotai, a server source can move to a query without a
projection step (`jotai-tanstack-query` exposes queries as atoms), if a future
need such as background refetch or optimistic mutations justifies it.

**What would flip the recommendation:** if React 19 is *not* wanted within the
next year, choose **option 3** and stay on Recoil, because option 1 is then a
large change without a user-visible effect. Re-decide when a dependency
requires React 19 or at the latest on 2027-11-01, and do not add new Recoil
atoms or selectors in the meantime beyond what features require.

## Consequences

If option 1 is accepted:

- The migration plan runs as its own sequence of branches and PRs. While it
  runs, both libraries ship (+8.4 kB on the main chunk at the start, then
  shrinking), and each phase leaves `dev` shippable.
- Temporary bridge hooks such as `useSmartSearchResults` exist until the
  state on their other side moves. The plan lists each one with the task that
  deletes it.
- Tests seed state through a Jotai store instead of `initializeState`; a
  shared helper keeps that to one line per test.
- `package.json` `engines` moves to `node >= 22.12` (Jotai 3).
- Removing `useTransitions={false}` from the router becomes possible after
  the last Recoil import is gone. It changes navigation timing, so it is a
  separate, browser-verified task, not part of the migration.
- The React 19 upgrade itself is a separate plan.

If option 3 is chosen instead: no code changes now. Recoil remains an
unmaintained dependency with a hard React 18 ceiling, and the exit grows with
every new atom.
