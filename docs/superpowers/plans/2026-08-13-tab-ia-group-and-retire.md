# Tab IA "Group & Retire" (Concept D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure Biddit2's flat 7-tab right column into a grouped 5-tab row ("This Semester": Details · Calendar · Summary ┃ "My Degree": Curriculum Map · Transcript), deleting the self-deprecated Study Overview, folding Smart Search into the left-column course list as a search mode, fixing the empty default state, and landing the enabler refactors (named tab enum, `useOpenCourseDetails` hook, GA4 tab telemetry, a11y/CSS fixes) that a later "Concept A" rework builds on.

**Architecture:** The tab row stays react-tabs driven from `Biddit2.jsx`, but `selectedTabAtom` switches from a bare integer to a named string id; index↔id mapping lives in one constants module, so reordering tabs is safe. All "open course details" navigation collapses into one hook. Smart Search's vector-DB query logic moves into a hook + Recoil atom and its results render through the existing virtualized `EventListContainer` list (which fixes its broken click-to-details and non-persisting add button for free). Nothing about the data layer changes.

**Tech Stack:** React 18 + Vite, Recoil 0.7, react-tabs 6.1, Tailwind, react-ga4, Vitest 3 + @testing-library/react + MSW.

## Global Constraints

- All commands run from `app/`: `cd app` first (CLAUDE.md).
- Run tests with an explicit timeout to avoid deadlocks (CLAUDE.md): `timeout 120 npx vitest run <file>` or `npx vitest run --testTimeout=10000 <file>`.
- `npm run lint` must pass with **0 warnings** before every commit.
- Conventional Commits. **No "Co-Authored-By: Claude" or any Claude Code mention in commit messages** (user preference, overrides any default).
- Work on branch `feature/tab-ia-group-and-retire` cut from `dev`. Commit per task. **Do not merge to `dev` or push without explicit user approval** (CLAUDE.md: only commit when allowed; user approved committing this feature).
- Never call `api.shsg.ch` except through the singleton `apiClient` (`helpers/axiosClient.js`) — it is the kill-switch enforcement point.
- No magic numbers (CLAUDE.md §63) — that is the point of Task 1.
- Do not deploy this near the bidding window; that is a release decision outside this plan.
- All file paths below are relative to `/Users/marc/Documents/GithubRepos/BidditRepos/Biddit2/`.

---

### Task 0: Branch setup

**Files:** none (git only)

- [ ] **Step 1: Create the branch off dev**

```bash
cd /Users/marc/Documents/GithubRepos/BidditRepos/Biddit2
git checkout dev && git pull
git checkout -b feature/tab-ia-group-and-retire
```

- [ ] **Step 2: Verify baseline is green**

```bash
cd app && npm install
timeout 300 npx vitest run
npm run lint
```
Expected: existing suite passes, lint clean. If baseline is red, STOP and report — do not build on a red baseline.

---

### Task 1: Named tab enum replaces integer tab state

The atom currently stores a bare integer (`recoil/selectedTabAtom.js`, default `0`) and five files hardcode indices `0`, `2`, `5`. Switch the atom to a string id; `Biddit2.jsx` maps id↔index at the react-tabs boundary so `TabComponent.jsx` (which takes `selectedTab: number`) needs no change in this task.

**Files:**
- Create: `app/src/constants/tabs.js`
- Create: `app/src/constants/__tests__/tabs.test.js`
- Modify: `app/src/components/recoil/selectedTabAtom.js`
- Modify: `app/src/pages/Biddit2.jsx:325-328` (TabComponent wiring)
- Modify: `app/src/components/leftCol/bottomRow/EventListContainer.jsx:261`
- Modify: `app/src/components/rightCol/SemesterSummary.jsx:98`
- Modify: `app/src/components/rightCol/CurriculumMap/CurriculumGrid.jsx:62`
- Modify: `app/src/components/rightCol/studyOverview/components/SemesterRow.jsx:95`
- Modify: `app/src/components/rightCol/studyOverview/components/StudyOverviewMigrationNotice.jsx:5,17`
- Modify: `app/src/components/rightCol/studyOverview/components/__tests__/StudyOverviewMigrationNotice.test.jsx:15,38`

**Interfaces:**
- Produces: `TAB` (object of string ids: `COURSE_DETAILS: "course-details"`, `CALENDAR: "calendar"`, `SUMMARY: "summary"`, `TRANSCRIPT: "transcript"`, `STUDY_OVERVIEW: "study-overview"`, `CURRICULUM_MAP: "curriculum-map"`, `SMART_SEARCH: "smart-search"`), `TAB_ORDER: string[]`, `tabIndexOf(tabId: string): number`, `tabIdAt(index: number): string`. `selectedTabAtom` now holds a `TAB.*` string, default `TAB.COURSE_DETAILS` (default changes to SUMMARY later, in Task 7).

- [ ] **Step 1: Write the failing test**

`app/src/constants/__tests__/tabs.test.js`:
```js
import { describe, expect, it } from "vitest";
import { TAB, TAB_ORDER, tabIndexOf, tabIdAt } from "../tabs";

describe("tab constants", () => {
  it("orders every tab exactly once", () => {
    expect(new Set(TAB_ORDER).size).toBe(TAB_ORDER.length);
    expect(TAB_ORDER.length).toBe(Object.keys(TAB).length);
  });

  it("maps ids to indices and back", () => {
    TAB_ORDER.forEach((id, i) => {
      expect(tabIndexOf(id)).toBe(i);
      expect(tabIdAt(i)).toBe(id);
    });
  });

  it("falls back to the first tab for unknown values", () => {
    expect(tabIndexOf("nonsense")).toBe(0);
    expect(tabIdAt(99)).toBe(TAB_ORDER[0]);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

```bash
cd app && timeout 120 npx vitest run src/constants/__tests__/tabs.test.js
```
Expected: FAIL — module `../tabs` not found.

- [ ] **Step 3: Create `app/src/constants/tabs.js`**

```js
/**
 * Named identifiers for the right-column tabs.
 * The Recoil atom stores these ids; react-tabs works with indices,
 * so Biddit2.jsx converts at the boundary via tabIndexOf/tabIdAt.
 * Reordering TAB_ORDER reorders the tab row without breaking navigation.
 */
export const TAB = {
  COURSE_DETAILS: "course-details",
  CALENDAR: "calendar",
  SUMMARY: "summary",
  TRANSCRIPT: "transcript",
  STUDY_OVERVIEW: "study-overview",
  CURRICULUM_MAP: "curriculum-map",
  SMART_SEARCH: "smart-search",
};

export const TAB_ORDER = [
  TAB.COURSE_DETAILS,
  TAB.CALENDAR,
  TAB.SUMMARY,
  TAB.TRANSCRIPT,
  TAB.STUDY_OVERVIEW,
  TAB.CURRICULUM_MAP,
  TAB.SMART_SEARCH,
];

export function tabIndexOf(tabId) {
  const index = TAB_ORDER.indexOf(tabId);
  return index === -1 ? 0 : index;
}

export function tabIdAt(index) {
  return TAB_ORDER[index] ?? TAB_ORDER[0];
}
```

- [ ] **Step 4: Run the test to verify pass**

```bash
timeout 120 npx vitest run src/constants/__tests__/tabs.test.js
```
Expected: PASS.

- [ ] **Step 5: Switch the atom to the string id**

`app/src/components/recoil/selectedTabAtom.js` becomes:
```js
import { atom } from "recoil";
import { TAB } from "../../constants/tabs";

export const selectedTabAtom = atom({
  key: "selectedTab",
  default: TAB.COURSE_DETAILS,
});
```

- [ ] **Step 6: Convert the react-tabs boundary in Biddit2.jsx**

At `app/src/pages/Biddit2.jsx`, add to imports:
```js
import { tabIndexOf, tabIdAt } from "../constants/tabs";
```
and change lines 325–328 from
```jsx
            <TabComponent
              selectedTab={selectedTabState}
              onTabSelect={(index) => setSelectedTabState(index)}
            />
```
to
```jsx
            <TabComponent
              selectedTab={tabIndexOf(selectedTabState)}
              onTabSelect={(index) => setSelectedTabState(tabIdAt(index))}
            />
```

- [ ] **Step 7: Replace the five hardcoded indices**

Each file adds `import { TAB } from` the correct relative path to `constants/tabs`.

1. `EventListContainer.jsx:261`: `data.setSelectedTabState(0);` → `data.setSelectedTabState(TAB.COURSE_DETAILS);` (import path `"../../../constants/tabs"`)
2. `SemesterSummary.jsx:98`: `setSelectedTab(0);` → `setSelectedTab(TAB.COURSE_DETAILS);` (import path `"../../constants/tabs"`)
3. `CurriculumGrid.jsx:62`: `setSelectedTab(0);` → `setSelectedTab(TAB.COURSE_DETAILS);` (import path `"../../../constants/tabs"`)
4. `studyOverview/components/SemesterRow.jsx:95`: `setSelectedTab(2);` → `setSelectedTab(TAB.SUMMARY);` (import path `"../../../../constants/tabs"`)
5. `StudyOverviewMigrationNotice.jsx`: delete line 5 (`const CURRICULUM_MAP_TAB_INDEX = 5;`), change line 17 to `onClick={() => setSelectedTab(TAB.CURRICULUM_MAP)}`, add the import (path `"../../../../constants/tabs"`).

- [ ] **Step 8: Fix the existing test that asserts integers**

`studyOverview/components/__tests__/StudyOverviewMigrationNotice.test.jsx`: add `import { TAB } from "../../../../../constants/tabs";` — line 15 `set(selectedTabAtom, 4)` → `set(selectedTabAtom, TAB.STUDY_OVERVIEW)`; line 38 `toHaveTextContent("5")` → `toHaveTextContent(TAB.CURRICULUM_MAP)`.

- [ ] **Step 9: Verify nothing still hardcodes an index**

```bash
grep -rn "setSelectedTab(0\|setSelectedTab(2\|setSelectedTab(5\|setSelectedTabState(0" src/ && echo "FOUND STRAGGLERS" || echo "clean"
timeout 300 npx vitest run
npm run lint
```
Expected: "clean"; full suite PASS; lint clean.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "refactor: replace integer tab indices with named tab ids"
```

---

### Task 2: One `useOpenCourseDetails` hook for all detail navigation

Three components duplicate `updateSelectedCourseInfo(x)` + `setSelectedTab(...)`. Collapse them into one hook that also emits the GA4 event telling us where detail views come from — data that informs the Concept A drawer later.

**Files:**
- Create: `app/src/components/helpers/useOpenCourseDetails.js`
- Create: `app/src/components/helpers/__tests__/useOpenCourseDetails.test.jsx`
- Modify: `app/src/components/leftCol/bottomRow/EventListContainer.jsx:71,75,259-263,372-382`
- Modify: `app/src/components/rightCol/SemesterSummary.jsx:95-100`
- Modify: `app/src/components/rightCol/CurriculumMap/CurriculumGrid.jsx:50-63`

**Interfaces:**
- Consumes: `TAB` from Task 1; `useUnifiedCourseData().updateSelectedCourseInfo(course)` (existing, `helpers/useUnifiedCourseData.js:746`).
- Produces: `useOpenCourseDetails(): (course, options?: { source?: string }) => void`. Passing a falsy course is a no-op. `source` values used: `"course-list"`, `"semester-summary"`, `"curriculum-map"`.

- [ ] **Step 1: Write the failing test**

`app/src/components/helpers/__tests__/useOpenCourseDetails.test.jsx`:
```jsx
import { fireEvent, render, screen } from "@testing-library/react";
import { RecoilRoot, useRecoilValue } from "recoil";
import { describe, expect, it, vi } from "vitest";
import ReactGA from "react-ga4";
import { selectedTabAtom } from "../../recoil/selectedTabAtom";
import { selectedCourseInfoSelector } from "../../recoil/unifiedCourseDataSelectors";
import { TAB } from "../../../constants/tabs";
import { useOpenCourseDetails } from "../useOpenCourseDetails";

vi.mock("react-ga4", () => ({ default: { event: vi.fn() } }));

const COURSE = { shortName: "Advanced Cybersecurity", courseNumber: "1234" };

const Harness = () => {
  const openCourseDetails = useOpenCourseDetails();
  const tab = useRecoilValue(selectedTabAtom);
  const selected = useRecoilValue(selectedCourseInfoSelector);
  return (
    <>
      <button onClick={() => openCourseDetails(COURSE, { source: "course-list" })}>
        open
      </button>
      <button onClick={() => openCourseDetails(null, { source: "course-list" })}>
        open-null
      </button>
      <output aria-label="tab">{tab}</output>
      <output aria-label="course">{selected?.shortName ?? "none"}</output>
    </>
  );
};

const renderHarness = () =>
  render(
    <RecoilRoot initializeState={({ set }) => set(selectedTabAtom, TAB.SUMMARY)}>
      <Harness />
    </RecoilRoot>,
  );

describe("useOpenCourseDetails", () => {
  it("sets the selected course and switches to the details tab", () => {
    renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "open" }));
    expect(screen.getByLabelText("tab")).toHaveTextContent(TAB.COURSE_DETAILS);
    expect(screen.getByLabelText("course")).toHaveTextContent("Advanced Cybersecurity");
    expect(ReactGA.event).toHaveBeenCalledWith("course_details_opened", {
      source: "course-list",
    });
  });

  it("ignores falsy courses", () => {
    renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "open-null" }));
    expect(screen.getByLabelText("tab")).toHaveTextContent(TAB.SUMMARY);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
timeout 120 npx vitest run src/components/helpers/__tests__/useOpenCourseDetails.test.jsx
```
Expected: FAIL — module `../useOpenCourseDetails` not found.

- [ ] **Step 3: Implement the hook**

`app/src/components/helpers/useOpenCourseDetails.js`:
```js
import { useSetRecoilState } from "recoil";
import ReactGA from "react-ga4";
import { selectedTabAtom } from "../recoil/selectedTabAtom";
import { TAB } from "../../constants/tabs";
import { useUnifiedCourseData } from "./useUnifiedCourseData";

/**
 * Single entry point for "show this course's details".
 * Owns the navigation policy so a future layout change (e.g. a drawer)
 * only has to change this hook, not every caller.
 */
export function useOpenCourseDetails() {
  const setSelectedTab = useSetRecoilState(selectedTabAtom);
  const { updateSelectedCourseInfo } = useUnifiedCourseData();

  return (course, { source = "unknown" } = {}) => {
    if (!course) return;
    updateSelectedCourseInfo(course);
    setSelectedTab(TAB.COURSE_DETAILS);
    ReactGA.event("course_details_opened", { source });
  };
}
```

- [ ] **Step 4: Run to verify pass**

```bash
timeout 120 npx vitest run src/components/helpers/__tests__/useOpenCourseDetails.test.jsx
```
Expected: PASS. (If `useUnifiedCourseData` pulls in fetch effects that hit MSW-unmocked endpoints, the MSW server warns but tests still pass; add handlers to `src/test/mocks/handlers.js` only if a hard failure occurs.)

- [ ] **Step 5: Convert the three call sites**

1. `EventListContainer.jsx` — add `import { useOpenCourseDetails } from "../../helpers/useOpenCourseDetails";`; inside the component body add `const openCourseDetails = useOpenCourseDetails();`. In the Row click handler (lines 259–263) replace
```jsx
          onClick={() => {
            data.updateSelectedCourseInfo(event);
            data.setSelectedTabState(0);
            data.setIsLeftViewVisibleState(false);
          }}
```
with
```jsx
          onClick={() => {
            data.openCourseDetails(event, { source: "course-list" });
            data.setIsLeftViewVisibleState(false);
          }}
```
(the mobile left-view flip stays — it is list-specific, not details-specific). In `itemData` (lines 373–382) remove `updateSelectedCourseInfo` and `setSelectedTabState`, add `openCourseDetails`. Then remove the now-unused `selectedTabAtom` import (line 54), the `const [, setSelectedTabState] = useRecoilState(selectedTabAtom);` (line 71), and drop `updateSelectedCourseInfo` from the destructuring at line 75 **only if** nothing else in the file uses it (`grep -n updateSelectedCourseInfo src/components/leftCol/bottomRow/EventListContainer.jsx`).
2. `SemesterSummary.jsx` — replace the body of `courseSelector` (lines 95–100) with `openCourseDetails(fullEvent, { source: "semester-summary" });` (the hook does the null check). Add the hook import + `const openCourseDetails = useOpenCourseDetails();`; delete the `selectedTabAtom` import (line 17) and `setSelectedTab` (line 26); keep `useUnifiedCourseData` only if still used elsewhere in the file.
3. `CurriculumGrid.jsx` — in `handleCourseClick` (lines 53–64) replace the `if (fullCourse) {...}` body with `openCourseDetails(fullCourse, { source: "curriculum-map" });`, update the `useCallback` deps to `[unifiedCourseData, openCourseDetails]`, delete the `selectedTabAtom` import (line 25) and `setSelectedTab` (line 51).

- [ ] **Step 6: Full verify + commit**

```bash
timeout 300 npx vitest run
npm run lint
git add -A && git commit -m "refactor: route all course-details navigation through useOpenCourseDetails"
```
Expected: suite PASS, lint clean.

---

### Task 3: GA4 tab-switch telemetry

Today the only analytics call is a pageview that never changes (`App.jsx:44`), so there is zero data on tab usage. Emit an event on every switch. One bidding window of this data is what decides Concept A's open questions.

**Files:**
- Modify: `app/src/pages/Biddit2.jsx` (the `onTabSelect` from Task 1)
- Create: `app/src/pages/__tests__/tabTelemetry.test.jsx`

**Interfaces:**
- Consumes: `tabIdAt` (Task 1), `ReactGA` (already initialized in `App.jsx:30`).
- Produces: GA4 event `tab_select` with `{ from: string, to: string }` (tab ids from Task 1).

- [ ] **Step 1: Write the failing test**

`app/src/pages/__tests__/tabTelemetry.test.jsx` — test the handler logic in isolation rather than mounting all of Biddit2 (which needs MSAL). Extract the handler first (Step 2) so it is testable:
```jsx
import { describe, expect, it, vi } from "vitest";
import ReactGA from "react-ga4";
import { TAB } from "../../constants/tabs";
import { makeTabSelectHandler } from "../tabSelectHandler";

vi.mock("react-ga4", () => ({ default: { event: vi.fn() } }));

describe("makeTabSelectHandler", () => {
  it("stores the new tab id and reports the transition", () => {
    const setSelectedTabState = vi.fn();
    const handler = makeTabSelectHandler(TAB.COURSE_DETAILS, setSelectedTabState);
    handler(1); // index 1 = calendar in TAB_ORDER
    expect(setSelectedTabState).toHaveBeenCalledWith(TAB.CALENDAR);
    expect(ReactGA.event).toHaveBeenCalledWith("tab_select", {
      from: TAB.COURSE_DETAILS,
      to: TAB.CALENDAR,
    });
  });

  it("does not report a no-op select", () => {
    const setSelectedTabState = vi.fn();
    const handler = makeTabSelectHandler(TAB.CALENDAR, setSelectedTabState);
    handler(1);
    expect(ReactGA.event).not.toHaveBeenCalled();
    expect(setSelectedTabState).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement**

```bash
timeout 120 npx vitest run src/pages/__tests__/tabTelemetry.test.jsx
```
Expected: FAIL — `../tabSelectHandler` not found. Then create `app/src/pages/tabSelectHandler.js`:
```js
import ReactGA from "react-ga4";
import { tabIdAt } from "../constants/tabs";

export function makeTabSelectHandler(currentTabId, setSelectedTabState) {
  return (index) => {
    const nextTabId = tabIdAt(index);
    if (nextTabId === currentTabId) return;
    ReactGA.event("tab_select", { from: currentTabId, to: nextTabId });
    setSelectedTabState(nextTabId);
  };
}
```
In `Biddit2.jsx`, import it and change the Task 1 wiring to:
```jsx
            <TabComponent
              selectedTab={tabIndexOf(selectedTabState)}
              onTabSelect={makeTabSelectHandler(selectedTabState, setSelectedTabState)}
            />
```
(`tabIdAt` import in Biddit2.jsx becomes unused — remove it.)

- [ ] **Step 3: Verify + commit**

```bash
timeout 120 npx vitest run src/pages/__tests__/tabTelemetry.test.jsx
timeout 300 npx vitest run
npm run lint
git add -A && git commit -m "feat: report tab_select and course_details_opened events to GA4"
```
Expected: PASS / PASS / clean.

---

### Task 4: Delete Study Overview

It carries its own deprecation notice pointing at Curriculum Map (`StudyOverviewMigrationNotice.jsx:14`). Delete the UI; **keep the data layer** — `buildStudyOverviewView` etc. in `helpers/academicDataTransformers.js` are consumed by Transcript (`Transcript.jsx:31,39,115,122`) and the scorecard pipeline.

**Files:**
- Modify: `app/src/pages/TabComponent.jsx:15,54,89-97` (remove import, Tab, TabPanel)
- Modify: `app/src/constants/tabs.js` (remove `STUDY_OVERVIEW` from `TAB` and `TAB_ORDER`)
- Delete: `app/src/components/rightCol/StudyOverview.jsx`
- Delete: `app/src/components/rightCol/studyOverview/` (entire folder, including `components/`, `utils/`, and the migration-notice test)
- Possibly delete: `app/src/components/helpers/studyOverviewHelpers.js` and `LoadingSkeletonStudyOverview` in `app/src/components/rightCol/LoadingSkeletons.jsx` (Step 3 decides by grep)

**Interfaces:**
- Consumes: Task 1's enum (so removing a tab cannot silently misroute anything).
- Produces: `TAB_ORDER` is now `[COURSE_DETAILS, CALENDAR, SUMMARY, TRANSCRIPT, CURRICULUM_MAP, SMART_SEARCH]`. `TAB.STUDY_OVERVIEW` no longer exists — the enum makes any survivor reference a hard import error, not a silent misroute.

- [ ] **Step 1: Remove the tab**

In `TabComponent.jsx`: delete line 15 (`import StudyOverview ...`), the `<Tab className={tabStyle}>Study Overview</Tab>` (line 54), and the Study Overview `<TabPanel>` block (lines 89–97). In `constants/tabs.js`, remove `STUDY_OVERVIEW: "study-overview",` from `TAB` and `TAB.STUDY_OVERVIEW,` from `TAB_ORDER`.

- [ ] **Step 2: Delete the component tree**

```bash
git rm src/components/rightCol/StudyOverview.jsx
git rm -r src/components/rightCol/studyOverview
```
(This also removes `SemesterRow.jsx` — one of the five old jump sites — and `StudyOverviewMigrationNotice` + its test.)

- [ ] **Step 3: Sweep for dangling references**

```bash
grep -rn "studyOverview\|StudyOverview" src/ --include="*.jsx" --include="*.js" | grep -v academicDataTransformers | grep -v unifiedDataTransforms | grep -v "studyOverviewView"
```
For each hit, decide: `helpers/studyOverviewHelpers.js` — delete if its only importers were the deleted components (verify with `grep -rn "studyOverviewHelpers" src/`); `LoadingSkeletonStudyOverview` in `LoadingSkeletons.jsx` — delete the export if nothing imports it anymore; comments in helper files — leave. The data-layer exports (`buildStudyOverviewView`, `buildSemesterStudyOverview`, `academicData.studyOverviewView` consumers in `Transcript.jsx` and `useScorecardFetching.js`/`useInitializeScorecards.js`) **stay**.

- [ ] **Step 4: Verify + commit**

```bash
timeout 300 npx vitest run
npm run lint
npm run build
git add -A && git commit -m "feat!: remove deprecated Study Overview tab (replaced by Curriculum Map)"
```
Expected: suite PASS (the migration-notice test was deleted with its component), lint clean, build succeeds.

---

### Task 5: Fold Smart Search into the left-column list

Smart Search is a second course list wearing a tab costume: it duplicates the pool's filters, its click-to-details is commented out (`SmartSearch.jsx:588-593`), and its lock button only mutates *local* state without persisting (`SmartSearch.jsx:573-581`). Fold it into the pool as a search **mode**: the results flow through `EventListContainer`'s existing virtualized rows, so add/lock, drag-to-curriculum-map, conflict highlighting, and click-to-details all work identically for semantic results. The vector-DB orchestration (404 → upsert → retry, reference-semester guardrail per `REFERENCE_SEMESTER.md`) moves verbatim into a hook.

**Files:**
- Create: `app/src/components/recoil/smartSearchAtom.js`
- Create: `app/src/components/helpers/useSmartSearch.js` (logic moved from `SmartSearch.jsx`)
- Create: `app/src/components/leftCol/topRow/SearchModeToggle.jsx`
- Create: `app/src/components/leftCol/topRow/__tests__/SearchModeToggle.test.jsx`
- Create: `app/src/components/recoil/__tests__/smartSearchResults.test.js`
- Modify: `app/src/components/leftCol/topRow/SearchTerm.jsx` (mode-aware input)
- Modify: `app/src/components/leftCol/topRow/SelectOptions.jsx` (render the toggle above the search input; check the actual JSX — the toggle goes directly above `<SearchTerm />`)
- Modify: `app/src/components/leftCol/bottomRow/EventListContainer.jsx:93-100` (course source switch)
- Modify: `app/src/components/recoil/unifiedCourseDataSelectors.js` (new `smartSearchResultsSelector`)
- Modify: `app/src/pages/TabComponent.jsx` (remove Smart Search Tab + TabPanel + import)
- Modify: `app/src/constants/tabs.js` (remove `SMART_SEARCH`)
- Delete: `app/src/components/rightCol/SmartSearch.jsx`

**Interfaces:**
- Consumes: `querySimilarCourses` / `upsertSimilarCourses` from `helpers/similarCoursesApi.js` (signatures documented in that file); `availableCoursesSelector(semester)` and `semesterMetadataSelector(semester)` from `recoil/unifiedCourseDataSelectors`; `mainProgramSelector`; `authTokenState`.
- Produces:
  - `smartSearchState` atom: `{ mode: "keyword" | "smart", query: string, resultIds: string[], distances: number[], isLoading: boolean, hasSearched: boolean }`, default `{ mode: "keyword", query: "", resultIds: [], distances: [], isLoading: false, hasSearched: false }`.
  - `useSmartSearch(): { runSearch: (query: string) => Promise<void> }` — runs the query for the currently selected semester and writes `resultIds`/`distances`/`isLoading`/`hasSearched` into `smartSearchState`.
  - `smartSearchResultsSelector` (in `unifiedCourseDataSelectors.js`): maps `resultIds` → full course objects from `availableCoursesSelector(selectedSemester)` using the id normalization `id.replace(/[A-Z]+\d+/g, "")` (same as `SmartSearch.jsx:551-553`), ordered by ascending distance, dropping ids with no matching course.

- [ ] **Step 1: Write the failing selector test**

`app/src/components/recoil/__tests__/smartSearchResults.test.js`:
```js
import { describe, expect, it } from "vitest";
import { orderSmartResults } from "../smartSearchAtom";

const COURSES = [
  { courseNumber: "111", shortName: "A" },
  { courseNumber: "222", shortName: "B" },
  { courseNumber: "333", shortName: "C" },
];

describe("orderSmartResults", () => {
  it("maps ids to courses ordered by distance and drops unknown ids", () => {
    const result = orderSmartResults({
      resultIds: ["HSG1222", "HSG1111", "HSG1999"],
      distances: [0.4, 0.1, 0.2],
      courses: COURSES,
    });
    expect(result.map((c) => c.shortName)).toEqual(["A", "B"]);
  });

  it("returns [] when there are no results", () => {
    expect(orderSmartResults({ resultIds: [], distances: [], courses: COURSES })).toEqual([]);
  });
});
```
Note: the pure ordering function lives next to the atom so it is unit-testable without Recoil; the selector is a thin wrapper.

- [ ] **Step 2: Run to verify failure, then create the atom module**

```bash
timeout 120 npx vitest run src/components/recoil/__tests__/smartSearchResults.test.js
```
Expected: FAIL. Then `app/src/components/recoil/smartSearchAtom.js`:
```js
import { atom } from "recoil";

export const smartSearchState = atom({
  key: "smartSearchState",
  default: {
    mode: "keyword",
    query: "",
    resultIds: [],
    distances: [],
    isLoading: false,
    hasSearched: false,
  },
});

/**
 * Map vector-DB result ids to full course objects, best match first.
 * Ids carry a semester prefix (e.g. "HSG1<courseNumber>"); the same
 * normalization SmartSearch used strips it before matching.
 */
export function orderSmartResults({ resultIds, distances, courses }) {
  return resultIds
    .map((id, i) => ({
      course: courses.find(
        (c) => c.courseNumber === id.replace(/[A-Z]+\d+/g, "")
      ),
      distance: distances[i] ?? Infinity,
    }))
    .filter((entry) => entry.course)
    .sort((a, b) => a.distance - b.distance)
    .map((entry) => entry.course);
}
```
Add to `unifiedCourseDataSelectors.js`:
```js
import { smartSearchState, orderSmartResults } from "./smartSearchAtom";

export const smartSearchResultsSelector = selector({
  key: "smartSearchResultsSelector",
  get: ({ get }) => {
    const search = get(smartSearchState);
    const courseData = get(unifiedCourseDataState);
    const semester = courseData.selectedSemester;
    const available = courseData.semesters?.[semester]?.available || [];
    return orderSmartResults({
      resultIds: search.resultIds,
      distances: search.distances,
      courses: available,
    });
  },
});
```
(Match the file's existing import style for `unifiedCourseDataState` — it is already imported there.)

- [ ] **Step 3: Run selector test to verify pass**

```bash
timeout 120 npx vitest run src/components/recoil/__tests__/smartSearchResults.test.js
```
Expected: PASS.

- [ ] **Step 4: Move the query orchestration into `useSmartSearch`**

Create `app/src/components/helpers/useSmartSearch.js`. Move — as verbatim as possible — from `SmartSearch.jsx`: the `fetchSimilarCourses` function and everything it needs (`derivedProgram` derivation, `programRef`, the reference-semester resolution around `semesterMetadataSelector` at lines 42–62, the 404 → `upsertSimilarCourses` → retry orchestration, and the long-loading timer if desired). Public shape:
```js
export function useSmartSearch() {
  // ... moved hooks/state, writing into smartSearchState instead of local useState
  return { runSearch };
}
```
`runSearch(query)`: sets `isLoading: true`, `query`, calls the moved orchestration, then writes `{ resultIds: response.ids?.[0] ?? [], distances: response.distances?.[0] ?? [], isLoading: false, hasSearched: true }`. All HTTP stays inside `querySimilarCourses`/`upsertSimilarCourses` (which already use `apiClient` — kill-switch safe). **Do not re-implement the guardrail logic; move it.** Delete the per-course category/credits dropdown filters — the pool's existing Classification/ECTS filters do not apply to smart results (accepted scope cut; note it in the ADR).

- [ ] **Step 5: Write the failing toggle test, then build the toggle + input**

`app/src/components/leftCol/topRow/__tests__/SearchModeToggle.test.jsx`:
```jsx
import { fireEvent, render, screen } from "@testing-library/react";
import { RecoilRoot, useRecoilValue } from "recoil";
import { describe, expect, it } from "vitest";
import { smartSearchState } from "../../../recoil/smartSearchAtom";
import SearchModeToggle from "../SearchModeToggle";

const ModeValue = () => {
  const search = useRecoilValue(smartSearchState);
  return <output aria-label="mode">{search.mode}</output>;
};

describe("SearchModeToggle", () => {
  it("switches between keyword and smart mode", () => {
    render(
      <RecoilRoot>
        <SearchModeToggle />
        <ModeValue />
      </RecoilRoot>,
    );
    expect(screen.getByLabelText("mode")).toHaveTextContent("keyword");
    fireEvent.click(screen.getByRole("button", { name: /smart/i }));
    expect(screen.getByLabelText("mode")).toHaveTextContent("smart");
    fireEvent.click(screen.getByRole("button", { name: /keyword/i }));
    expect(screen.getByLabelText("mode")).toHaveTextContent("keyword");
  });
});
```
Run (expect FAIL), then create `SearchModeToggle.jsx`:
```jsx
import { useRecoilState } from "recoil";
import { smartSearchState } from "../../recoil/smartSearchAtom";

const baseStyle =
  "flex-1 py-1 text-xs font-medium rounded-md transition-colors";

export default function SearchModeToggle() {
  const [search, setSearch] = useRecoilState(smartSearchState);

  const setMode = (mode) =>
    setSearch((prev) => ({ ...prev, mode, hasSearched: false, resultIds: [], distances: [] }));

  return (
    <div className="flex gap-1 p-0.5 mb-1 bg-gray-100 rounded-lg" role="group" aria-label="Search mode">
      <button
        type="button"
        onClick={() => setMode("keyword")}
        className={`${baseStyle} ${search.mode === "keyword" ? "bg-hsg-800 text-white" : "text-gray-600 hover:bg-gray-200"}`}
      >
        Keyword
      </button>
      <button
        type="button"
        onClick={() => setMode("smart")}
        className={`${baseStyle} ${search.mode === "smart" ? "bg-hsg-800 text-white" : "text-gray-600 hover:bg-gray-200"}`}
      >
        Smart ✨
      </button>
    </div>
  );
}
```
(Verify `bg-hsg-800` exists in the Tailwind theme — CLAUDE.md documents `hsg-50`…`hsg-900`; if the exact token differs, use the same class the active tab uses.) Render `<SearchModeToggle />` immediately above `<SearchTerm />` in `SelectOptions.jsx`. In `SearchTerm.jsx`: read `smartSearchState`; in smart mode change the placeholder to `Describe what you want to learn…`, call `useSmartSearch().runSearch(searchTerm)` on Enter, and **skip** writing `selectionOptions.searchTerm` (keyword filtering must not react to smart queries). Keep keyword behavior byte-identical in keyword mode.

- [ ] **Step 6: Switch the list source in EventListContainer**

In `EventListContainer.jsx` after line 100:
```jsx
  const smartSearch = useRecoilValue(smartSearchState);
  const smartResults = useRecoilValue(smartSearchResultsSelector);
  const smartActive = smartSearch.mode === "smart" && smartSearch.hasSearched;
  const displayedCourses = smartActive ? smartResults : filteredCourses;
```
Then replace every subsequent use of `filteredCourses` in the render path (`itemData.filteredCourses`, `itemCount`, the empty check at line 402) with `displayedCourses` (the Row already reads `data.filteredCourses[index]` — keep that key name in `itemData` to avoid touching Row: `itemData = { filteredCourses: displayedCourses, ... }`). While smart `isLoading`, reuse the existing `LoadingRow`. Empty smart result → the existing `NoCoursesRow` is acceptable.

- [ ] **Step 7: Remove the tab and delete SmartSearch.jsx**

In `TabComponent.jsx`: remove the import (line 16), the `<Tab className={tabStyle}>Smart Search</Tab>`, and its `<TabPanel>`. In `constants/tabs.js`: remove `SMART_SEARCH`. Then:
```bash
git rm src/components/rightCol/SmartSearch.jsx
grep -rn "SmartSearch\|smart-search" src/ --include="*.jsx" --include="*.js" | grep -v smartSearch  # expect only smartSearchAtom/useSmartSearch/SearchModeToggle hits
```

- [ ] **Step 8: Full verify + commit**

```bash
timeout 300 npx vitest run
npm run lint
npm run build
git add -A && git commit -m "feat!: fold Smart Search into the course list as a search mode"
```
Manual smoke test (`npm run dev`, port 3000): toggle to Smart, search "programming basics", verify results render in the left list, a result row click opens Course Details, the + button persists the course (appears in Summary), and drag-to-Curriculum-Map works from a smart result row.

---

### Task 6: Grouped, scope-labeled 5-tab row + one-time move notice

**Files:**
- Modify: `app/src/pages/TabComponent.jsx` (order, group labels, divider)
- Modify: `app/src/constants/tabs.js` (final order)
- Create: `app/src/components/common/IaChangeNotice.jsx`
- Create: `app/src/components/common/__tests__/IaChangeNotice.test.jsx`
- Modify: `app/src/pages/Biddit2.jsx` (render notice above TabComponent)

**Interfaces:**
- Consumes: Task 1 enum (reordering is now free), Tasks 4–5 (5 tabs remain).
- Produces: final `TAB_ORDER = [COURSE_DETAILS, CALENDAR, SUMMARY, CURRICULUM_MAP, TRANSCRIPT]` — Transcript moves last so the row reads left→right as This-Semester → My-Degree.

- [ ] **Step 1: Write the failing notice test**

`app/src/components/common/__tests__/IaChangeNotice.test.jsx`:
```jsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import IaChangeNotice, { IA_NOTICE_STORAGE_KEY } from "../IaChangeNotice";

describe("IaChangeNotice", () => {
  beforeEach(() => localStorage.clear());

  it("shows until dismissed, then stays hidden", () => {
    const { unmount } = render(<IaChangeNotice />);
    expect(screen.getByText(/smart search now lives/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText(/smart search now lives/i)).not.toBeInTheDocument();
    unmount();
    render(<IaChangeNotice />);
    expect(screen.queryByText(/smart search now lives/i)).not.toBeInTheDocument();
    expect(localStorage.getItem(IA_NOTICE_STORAGE_KEY)).toBe("true");
  });
});
```

- [ ] **Step 2: Run (expect FAIL), implement the notice**

`app/src/components/common/IaChangeNotice.jsx` (same dismissible-banner pattern as the curriculum-map drag hint):
```jsx
import { useState } from "react";
import { InformationCircleIcon, XIcon } from "@heroicons/react/outline";

export const IA_NOTICE_STORAGE_KEY = "biddit-ia-notice-dismissed-v1";

export default function IaChangeNotice() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(IA_NOTICE_STORAGE_KEY) === "true"
  );

  if (dismissed) return null;

  return (
    <div className="mx-1 mt-2 flex items-start gap-2.5 rounded-md border border-blue-200 bg-blue-50 p-3">
      <InformationCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
      <p className="flex-1 text-sm text-blue-800">
        We tidied up: Smart Search now lives in the course list on the left
        (toggle Keyword / Smart), and Study Overview has been retired in favor
        of the Curriculum Map.
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem(IA_NOTICE_STORAGE_KEY, "true");
          setDismissed(true);
        }}
        className="text-blue-500 hover:text-blue-800"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
```
Render `<IaChangeNotice />` in `Biddit2.jsx` directly above the `<TabComponent ...>` Suspense block, inside the right column container.

- [ ] **Step 3: Reorder + group the tab row**

`constants/tabs.js` final order:
```js
export const TAB_ORDER = [
  TAB.COURSE_DETAILS,
  TAB.CALENDAR,
  TAB.SUMMARY,
  TAB.CURRICULUM_MAP,
  TAB.TRANSCRIPT,
];
```
In `TabComponent.jsx`, replace the TabList block (Tabs props unchanged) with a scope-label row plus the grouped list — the panels must be reordered to match (Details, Calendar, Summary, CurriculumMap, Transcript):
```jsx
      <div
        aria-hidden="true"
        className="flex w-full px-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500"
      >
        <span className="flex-[3] text-center">This Semester</span>
        <span className="flex-[2] text-center">My Degree</span>
      </div>
      <TabList className="flex w-full p-1">
        <Tab className={tabStyle}>Course Details</Tab>
        <Tab className={tabStyle}>Calendar</Tab>
        <Tab className={tabStyle}>{dynamicSummaryText}</Tab>
        <Tab className={`${tabStyle} ml-4`}>Curriculum Map</Tab>
        <Tab className={tabStyle}>Transcript</Tab>
      </TabList>
```
The `ml-4` gap plus the label row is the group divider (react-tabs counts only `Tab`-role children, so no non-Tab divider element is inserted into TabList — safer with its index bookkeeping). `flex-wrap` is intentionally dropped here; Task 8 makes the row scrollable on mobile instead of wrapping.

- [ ] **Step 4: Verify + commit**

```bash
timeout 300 npx vitest run
npm run lint
git add -A && git commit -m "feat: group tab row by scope (This Semester / My Degree) with one-time notice"
```
Manual check in `npm run dev`: five tabs in two visual groups; keyboard arrow navigation still cycles all five; Study Overview jump sites are gone (deleted in Task 4).

---

### Task 7: Useful default view + real Course Details empty state

Today every first load shows a mostly blank pane with "Click on a course to see details." (`CourseInfo.jsx:180`) because the default tab is Course Details with no selection. Default to the Summary tab (always meaningful: shows the cart, or a sensible empty cart) and give Course Details a real empty state.

**Files:**
- Modify: `app/src/components/recoil/selectedTabAtom.js` (default → `TAB.SUMMARY`)
- Modify: `app/src/components/rightCol/CourseInfo.jsx:160-200` (early-return empty state)
- Create: `app/src/components/rightCol/__tests__/CourseInfoEmptyState.test.jsx`

**Interfaces:**
- Consumes: `TAB` (Task 1); `selectedCourseInfoSelector` (existing).
- Produces: no new exports; behavior change only.

- [ ] **Step 1: Write the failing test**

`app/src/components/rightCol/__tests__/CourseInfoEmptyState.test.jsx`:
```jsx
import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { RecoilRoot } from "recoil";
import { describe, expect, it } from "vitest";
import CourseInfo from "../CourseInfo";

describe("CourseInfo with no course selected", () => {
  it("renders a helpful empty state instead of a blank pane", async () => {
    render(
      <RecoilRoot>
        <Suspense fallback={null}>
          <CourseInfo />
        </Suspense>
      </RecoilRoot>,
    );
    expect(
      await screen.findByText(/select a course to see its details/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/click on a course to see details/i),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run (expect FAIL), implement**

In `CourseInfo.jsx`, immediately after the hooks (before the current `return` at line 160), add:
```jsx
  if (!selectedCourse || selectedCourse.shortName === undefined) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg p-8 text-center text-gray-600 shadow-sm">
        <p className="text-lg font-semibold text-gray-800">
          Select a course to see its details
        </p>
        <p className="max-w-sm text-sm">
          Click any course in the list on the left — its ratings, exam format
          and description will show up here.
        </p>
      </div>
    );
  }
```
Then simplify the now-guaranteed-nonempty path: the header fallback string at lines 178–180 becomes just `{selectedCourse.shortName}`, and the `? ... : null` conditional wrapper at lines 200/227 can drop its null branch (the guard above covers it). Change `selectedTabAtom.js` default from `TAB.COURSE_DETAILS` to `TAB.SUMMARY`.

- [ ] **Step 3: Verify + commit**

```bash
timeout 120 npx vitest run src/components/rightCol/__tests__/CourseInfoEmptyState.test.jsx
timeout 300 npx vitest run
npm run lint
git add -A && git commit -m "feat: land on Semester Summary by default and add Course Details empty state"
```
Manual check: fresh load (clear site data) lands on the Summary tab; opening Course Details without a selection shows the new empty state; mobile initial view now shows something useful in the Tabs pane.

---

### Task 8: Cut avoidable refetches + preserve Curriculum Map state across switches

react-tabs unmounts unselected panels (`forceRender` defaults false), so every visit refires mount effects. Two targeted fixes — not blanket `forceRender` (which would front-load every panel's fetches at startup and break FullCalendar's sizing inside `display:none`):
1. `CourseInfo` refetches the **static** ExaminationTypes list on every remount (`CourseInfo.jsx:103-109`) — guard it on the atom already caching it.
2. Curriculum Map loses drag/plan/scroll state on every switch — `forceRender` just that panel (its data hooks already guard refetching via `initializedSemestersState`/plan registry; verify in Step 3).

**Files:**
- Modify: `app/src/components/rightCol/CourseInfo.jsx:103-109`
- Modify: `app/src/pages/TabComponent.jsx` (CurriculumMap TabPanel)
- Create: `app/src/components/rightCol/__tests__/examinationTypesFetchGuard.test.jsx`

**Interfaces:**
- Consumes: `examinationTypesState` atom (existing, `recoil/examinationTypesAtom.js`).
- Produces: behavior change only.

- [ ] **Step 1: Write the failing test**

`app/src/components/rightCol/__tests__/examinationTypesFetchGuard.test.jsx`:
```jsx
import { render } from "@testing-library/react";
import { Suspense } from "react";
import { RecoilRoot } from "recoil";
import { describe, expect, it, vi } from "vitest";
import { apiClient } from "../../helpers/axiosClient";
import { authTokenState } from "../../recoil/authAtom";
import { examinationTypesState } from "../../recoil/examinationTypesAtom";
import CourseInfo from "../CourseInfo";

describe("ExaminationTypes fetch guard", () => {
  it("does not refetch when the atom is already populated", () => {
    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({ data: [] });
    render(
      <RecoilRoot
        initializeState={({ set }) => {
          set(authTokenState, "token");
          set(examinationTypesState, { 1: { shortName: "MC", description: "x" } });
        }}
      >
        <Suspense fallback={null}>
          <CourseInfo />
        </Suspense>
      </RecoilRoot>,
    );
    const examCalls = getSpy.mock.calls.filter(([url]) =>
      String(url).includes("ExaminationTypes"),
    );
    expect(examCalls).toHaveLength(0);
    getSpy.mockRestore();
  });
});
```
(Check `examinationTypesAtom.js` for its default — if it defaults to `null` instead of `{}`, adapt the guard and test accordingly.)

- [ ] **Step 2: Run (expect FAIL), implement the guard**

In `CourseInfo.jsx`, change the effect at lines 103–109 to:
```jsx
  useEffect(() => {
    const alreadyLoaded =
      examinationIdState && Object.keys(examinationIdState).length > 0;
    if (authToken && !alreadyLoaded) {
      fetchExaminationIds();
    }
    //never include setters
    // eslint-disable-next-line
  }, [authToken]);
```

- [ ] **Step 3: forceRender the Curriculum Map panel**

First verify its loaders are idempotent: read `useCurriculumMapCourseLoader` / `useCurriculumPlan` usage in `rightCol/CurriculumMap/CurriculumMap.jsx` and confirm fetches are guarded (plan registry / `initializedSemestersState` / `lastFetched`). If guarded, change its TabPanel in `TabComponent.jsx` to `<TabPanel forceRender>`. If **not** guarded, skip the forceRender (leave a one-line note in the ADR) — do not add an unguarded fetch to app startup.

- [ ] **Step 4: Verify + commit**

```bash
timeout 300 npx vitest run
npm run lint
git add -A && git commit -m "perf: cache ExaminationTypes fetch and keep Curriculum Map mounted"
```
Manual check: switch Details → Calendar → Details with devtools Network open; `AcametaApi/ExaminationTypes` fires at most once per session. Curriculum Map keeps scroll/plan selection across tab switches (if forceRender applied); drag from list still works after several switches.

---

### Task 9: A11y + mobile tab-bar CSS fixes

Two known defects in `app/src/pages/react-tabs.css`: (a) the selected tab — exactly the one that receives keyboard focus under roving tabindex — has its focus outline suppressed (`lines 29-31`), a WCAG 2.4.7 failure; (b) the mobile media block (lines 63–84) targets `.react-tabs__tab-list` / `.react-tabs__tab` classes that the Tailwind `className` overrides replaced, so it has never applied — 5 tabs at 375px squeeze illegibly.

**Files:**
- Modify: `app/src/pages/react-tabs.css`
- Modify: `app/src/pages/TabComponent.jsx` (TabList/tabStyle responsive classes)

**Interfaces:** none — CSS/classes only.

- [ ] **Step 1: Fix focus visibility**

In `react-tabs.css`: delete the block
```css
.react-tabs__tab--selected:focus-visible {
  outline: none !important;
}
```
and replace the pair
```css
.react-tabs__tab:focus {
  outline: none;
}

.react-tabs__tab:focus:after { ... }
```
with
```css
.react-tabs__tab:focus-visible {
  outline: 2px solid #1f2937;
  outline-offset: 2px;
}
```

- [ ] **Step 2: Make the tab row scroll horizontally on small screens**

Delete the dead `@media (max-width: 768px)` block (lines 63–84) from `react-tabs.css`. In `TabComponent.jsx` make the real classes responsive:
```jsx
  const tabStyle =
    "flex-none min-w-max whitespace-nowrap px-3 md:px-0 md:flex-1 h-10 text-center justify-center items-center flex font-medium lg:font-semibold text-xs lg:text-sm rounded-md text-white bg-neutral mx-1";
```
and TabList: `className="flex w-full p-1 overflow-x-auto scrollbar-hide md:overflow-visible"` (the `scrollbar-hide` utility exists via `tailwind-scrollbar-hide`). Apply the same responsive treatment to the scope-label row from Task 6 (`hidden md:flex` is acceptable — the labels are decorative and `aria-hidden`).

- [ ] **Step 3: Verify + commit**

```bash
timeout 300 npx vitest run
npm run lint
npm run build
git add -A && git commit -m "fix: visible tab focus ring and horizontally scrollable tab bar on mobile"
```
Manual check: Tab key into the tab row shows a visible ring on the selected tab; arrow keys move it visibly. At 375px (devtools) the five tabs scroll horizontally with legible one-line labels.

---

### Task 10: Docs — ADR, CHANGELOG, CLAUDE.md cleanup

**Files:**
- Create: `docs/adr/000X-tab-ia-group-and-retire.md` (pick the next free number: `ls docs/adr/`)
- Modify: `CHANGELOG.md` (repo root; create if absent)
- Modify: `CLAUDE.md`
- Create/Modify: `docs/plan.md` (CLAUDE.md workflow requires it — point it at this plan)

**Interfaces:** none.

- [ ] **Step 1: Write the ADR**

`docs/adr/000X-tab-ia-group-and-retire.md` — Context: 7 flat tabs after 6 years of accretion; integer tab state with 5 hardcoded jump indices; zero tab telemetry; Study Overview self-deprecated; Smart Search duplicated the pool with broken details-click and non-persisting selection. Options considered: keep flat / group & retire (this) / full two-mode restructure (Concept A — deferred, see `docs/superpowers/plans/2026-08-13-tab-ia-group-and-retire.md` header and the saved Concept A spec). Decision: group & retire now; named tab ids + `useOpenCourseDetails` + `tab_select` telemetry as enablers for Concept A on a future `ui-revamp` branch. Consequences: 5 tabs, Smart Search results lose their per-result category/credits dropdowns (pool filters don't apply to smart results), Transcript's "Clear All Saved Courses" is now the only surviving destructive surface there (unchanged), one bidding window of telemetry before Concept A.

- [ ] **Step 2: Update CHANGELOG and CLAUDE.md**

CHANGELOG: one entry under a new version heading summarizing: grouped tab row, Study Overview removed, Smart Search moved into the course list, new default view, telemetry, a11y/mobile fixes. CLAUDE.md edits: §211-216 component list — remove `StudyOverview` (keep the note that `studyOverviewView` remains as a data shape used by Transcript), re-describe SmartSearch as "left-column search mode (`smartSearchAtom`, `useSmartSearch`); shared vector-DB logic in `helpers/similarCoursesApi.js`"; §256-266 file-structure — remove `studyOverview/` from the `rightCol` line; add `constants/tabs.js` to conventions ("tab navigation uses named ids — never integers"). Also fix the two stale claims found during discovery: `src/test/resilience/` does not exist (remove it from §266/§298), and verify whether `helpers/degradedModeService.js` exists on this branch — if not, soften §251 to reference the ADR instead.

- [ ] **Step 3: Final verification sweep**

```bash
cd app
timeout 300 npx vitest run
npm run lint
npm run build
git log --oneline dev..HEAD
```
Expected: all green; the log shows one commit per task, Conventional-Commit formatted, no Claude attribution. Then:
```bash
git add -A && git commit -m "docs: ADR, changelog and CLAUDE.md updates for tab IA restructure"
```

- [ ] **Step 4: Hand back for merge approval**

Report completion to the user with the manual-smoke-test checklist results (Tasks 5–9 each have one). **Do not merge `feature/tab-ia-group-and-retire` into `dev` or push without the user's go-ahead.** Remind: do not deploy in the two weeks before the bidding window.

---

## Self-review notes

- **Spec coverage:** grouped tab row (T6), Study Overview deletion (T4), Smart Search fold-in (T5), empty-state fix + default view (T7), enum (T1), details hook (T2), telemetry (T3), refetch/state fixes (T8), a11y + mobile CSS (T9), docs per CLAUDE.md (T10). Concept A explicitly out of scope (separate `ui-revamp` branch later).
- **Known judgment calls encoded above:** smart-results filters dropped (ADR-noted); `forceRender` only for Curriculum Map and only if its loaders are guarded; Transcript stays otherwise untouched; mobile default (`isLeftViewVisible: false`) intentionally unchanged — landing on Summary makes it useful now.
- **Type/name consistency check:** `TAB` / `TAB_ORDER` / `tabIndexOf` / `tabIdAt` (T1) used in T3/T4/T5/T6/T7; `useOpenCourseDetails` returns a callable taking `(course, { source })` (T2, consumed in T5 smoke test); `smartSearchState` shape defined once in T5 and consumed by `SearchModeToggle`/`SearchTerm`/`EventListContainer`; `orderSmartResults` exported from `smartSearchAtom.js` and wrapped by `smartSearchResultsSelector`.
