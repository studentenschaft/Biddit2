# 0002 — Tab IA: group and retire

- **Status:** Accepted
- **Date:** 2026-08-13
- **Branch:** `feature/tab-ia-group-and-retire`
- **Plan:** `docs/superpowers/plans/2026-08-13-tab-ia-group-and-retire.md`

## Context

Six years of feature accretion left the right column with seven flat, equally
weighted tabs. Concretely:

- **No hierarchy.** "Course Details", "Calendar", "Semester Summary" (this
  semester) sat next to "Study Overview", "Curriculum Map", "Transcript" (whole
  degree) and "Smart Search" (a search tool) with nothing signalling that they
  answer different questions.
- **Integer tab state.** `selectedTabAtom` stored a bare index and five call
  sites hardcoded `0`, `2` or `5` to jump between tabs. Reordering the row
  silently rerouted navigation.
- **No telemetry.** We had no idea which tabs were used, so every IA argument
  was an opinion.
- **Study Overview had self-deprecated.** It rendered its own "replaced by
  Curriculum Map" banner and duplicated Curriculum Map / Transcript data.
- **Smart Search duplicated the course pool.** It reimplemented the course row,
  which is why clicking a result did not open Course Details and the add button
  did not persist a selection.
- **Empty default.** The app landed on Course Details with no course selected —
  a blank panel on every cold start.

### Options considered

1. **Keep the flat row, fix only the bugs.** Cheapest, but leaves the IA problem
   and the integer state that blocks any future restructure.
2. **Group & retire (chosen).** Group the tabs by scope, retire what is
   genuinely dead, fold Smart Search into the surface it duplicates, and land
   the enabler refactors (named ids, one details hook, telemetry).
3. **Full two-mode restructure ("Concept A").** Split the app into a "Plan" and
   a "Browse" mode with a persistent course drawer. Much larger change,
   unvalidated by data, and it needs exactly the enablers option 2 delivers.

## Decision

Ship option 2 now and defer Concept A to a later `ui-revamp` branch, with this
work as its foundation.

**Tab row — 6 tabs, grouped by scope:**

```
This Semester: Details · Calendar · Summary  ┃  My Degree: Curriculum Map · Study Overview · Transcript
```

The row is data-driven from `app/src/constants/tabs.js`: `TAB` (named ids),
`TAB_LABELS`, `TAB_GROUPS` (the single source of order), and `TAB_ORDER`
derived from the groups via `flatMap` so the two cannot drift. `tabIndexOf` /
`tabIdAt` convert at the react-tabs boundary; nothing outside that boundary
speaks in indices any more.

The group boundary is drawn by a hairline `<li>` rule inside react-tabs'
`<ul role="tablist">` rather than by a bare margin, so the split is visible on
mobile too. It is safe because react-tabs indexes tabs by their `tabsRole`
(`getTabsCount`/`deepMap`) and, on click, by the `[data-rttab]` siblings only —
a non-Tab, non-focusable child cannot shift the bookkeeping. It is
`aria-hidden` because a `tablist` may only own `tab` children.

**Retirements and moves:**

- **Study Overview retained for now.** It was initially removed as
  self-deprecated, then kept at the user's request for this redesign. It sits in
  the *My Degree* group between Curriculum Map and Transcript and keeps its
  in-app migration notice pointing at Curriculum Map — it remains slated for
  replacement by Curriculum Map, just not in this change. The `studyOverviewView`
  data layer in `unifiedAcademicDataSelectors.js` was never touched.
- **Smart Search folded into the left column** as a `[Keyword | Smart]` mode on
  the course list (`recoil/smartSearchAtom.js`, `helpers/useSmartSearch.js`,
  `smartSearchResultsSelector`). Results flow through `EventListContainer`'s
  normal rows, so add/lock, drag-to-curriculum-map and click-to-details work for
  smart results without any duplicated row code. Switching mode clears both the
  visible box and the keyword filter, so the list never shows matches for a
  query the user has moved on from.
- **Default tab is Semester Summary**, and Course Details has a real empty state
  instead of a blank panel.

**Enablers for Concept A:**

- `helpers/useOpenCourseDetails.js` is the single entry point for "show this
  course" — it sets the course, switches the tab and emits
  `course_details_opened { source }`. A future drawer changes this hook only.
- `pages/tabSelectHandler.js` (`makeTabSelectHandler`) emits
  `tab_select { from, to }` on every user tab change, extracted from the page so
  telemetry is testable without mounting MSAL.

**Behavioural details worth recording:**

- **Curriculum Map is sticky-mounted:** it mounts on first visit and then stays
  mounted (`forceRender` gated on a "visited" set), rather than being force-
  rendered from app start. Force-rendering at startup would fire its loaders on
  every cold start and portal its first-visit tutorial `Dialog` to `body` before
  the user ever opened the tab.
- A **failed map load shows a "Try again" card** — user-driven retry, not an
  automatic one, so a broken backend cannot be hammered from an idle tab.
- **ExaminationTypes is fetched once per session** instead of per tab visit.
- The **focus ring is delivered by Tailwind `focus-visible:` utilities** on
  `tabStyle`. react-tabs sets its default classes via `defaultProps`, so the
  `className` we pass *replaces* them — only `--selected` and panel classes can
  be targeted from CSS. That trap is documented in the header of
  `pages/react-tabs.css`; the vendor stylesheet imports are gone entirely.
- **Mobile:** the tab row scrolls horizontally and the scope labels are hidden.
- A dismissible one-time `IaChangeNotice` explains the move, keyed in
  `localStorage` as `biddit-ia-notice-dismissed-v1`.

## Consequences

**Accepted trade-offs**

- **Smart results lose the per-result category/credits dropdown filters.** Pool
  filters (classification, ECTS, language, ratings, keyword) apply to the
  keyword-filtered pool and are not applied to smart results — a semantic query
  returns its ranked matches as-is. Re-narrowing a ranked list is a separate
  design question, deferred with Concept A.
- **`tab_select` misses programmatic tab switches.** It is wired to the
  react-tabs `onSelect` handler, so only user clicks are reported.
  `course_details_opened { source }` covers the remaining programmatic paths
  (`course-list`, `semester-summary`, `curriculum-map`, `similar-courses`).
- **GA4 needs configuration outside this repo:** `course_details_opened` and the
  `source` parameter must be registered as a custom event / custom dimension in
  the GA4 property before the data is queryable. Ops step, not a code change.
- **Sticky mount preserves state, not scroll position.** A hidden panel is
  `display: none`, which resets `scrollTop`; filters, selection and drag state
  survive a tab switch, the scroll offset does not.
- **Transcript's "Clear All Saved Courses" remains the only destructive surface**
  in the right column (unchanged by this work).
- **Study Overview's deprecation is deferred, not cancelled.** Keeping it means
  the *My Degree* group still holds two overlapping views of the same data, and
  the telemetry gathered this window is what should decide when it goes.
- We buy **one bidding window of telemetry** before committing to Concept A.

**Known follow-ups (not blocking this branch)**

- Delete the dead `recoil/scorecardEnrollmentsAtom.js` and
  `recoil/ApiScorecardEnrollments.jsx`.
- `helpers/studyOverviewHelpers.js` needs no pruning: the restore gave
  `getTypeColor`, `filterCoursesForSemester`, `calculateSemesterCredits` and
  `sortCoursesByType` their callers back (5/3/8/5 external references). The
  dead-export analysis this bullet used to carry only applies if Study Overview
  is retired again.
- Two files under `rightCol/studyOverview/` have zero importers and were
  restored byte-identically with the rest of the tree: `utils/
  studyOverviewUtils.js` (159 lines) and the `components/index.js` barrel, which
  every consumer bypasses by importing the components directly. Pre-existing
  dead weight, not introduced here; delete with the component or sooner.
- The smart-mode toggle lives inside the collapsible *Search & Filter* panel, so
  collapsing it hides the escape hatch back to keyword mode while smart results
  stay on screen. Either lift the toggle out of the collapsible region or keep a
  mode indicator visible when it is collapsed.
- Add a cap and backoff to the 800 ms smart-search program retry in
  `helpers/useSmartSearch.js`.
- Extract the shared `extractQueryIds` response parsing in
  `helpers/similarCoursesApi.js`.
