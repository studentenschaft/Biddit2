# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Tab row grouped by scope — *This Semester* (Course Details · Calendar ·
  Semester Summary) and *My Degree* (Curriculum Map · Study Overview ·
  Transcript) — driven from the new `constants/tabs.js` (`TAB`, `TAB_GROUPS`,
  `TAB_ORDER`, `TAB_LABELS`). A hairline rule separates the two groups at every
  screen width.
- Smart (semantic) search as a `[Keyword | Smart]` mode on the left-column
  course list. Results render through the normal course rows, so add/lock,
  drag-to-curriculum-map and click-to-details now work for them. A compact
  explainer below the toggle carries over the retired tab's usage hint, shown
  only in smart mode.
- Empty state on Course Details when no course is selected.
- "Try again" card when the Curriculum Map fails to load.
- GA4 events: `tab_select { from, to }` on user tab changes and
  `course_details_opened { source }` on every path into Course Details.
- One-time dismissible notice explaining the new tab layout
  (`biddit-ia-notice-dismissed-v1` in `localStorage`).

### Changed

- The app now opens on **Semester Summary** instead of an empty Course Details
  panel.
- Study Overview moved into the *My Degree* tab group; it is still marked as
  migrating to Curriculum Map and keeps its in-app notice.
- `selectedTabAtom` stores a named tab id instead of an integer index;
  index↔id conversion happens only at the react-tabs boundary.
- All "open course details" navigation goes through the single
  `useOpenCourseDetails` hook.
- Curriculum Map is sticky-mounted: it mounts on first visit and stays mounted,
  so its state survives tab switches (scroll position does not).
- Tab focus ring is delivered via Tailwind `focus-visible:` utilities; the
  vendor react-tabs stylesheet imports were dropped.
- On mobile the tab row scrolls horizontally and the scope labels are hidden.

### Removed

- **Smart Search tab** — replaced by the left-column search mode above. Smart
  results no longer offer the per-result category/credits dropdown filters.

### Fixed

- Clicking a smart-search result opens Course Details, and adding one to the
  wishlist persists (both were broken in the old Smart Search tab).
- The full course catalog is only upserted to the vector DB when the query
  returns an explicit empty ids list, never when the response omits `ids`.
- `ExaminationTypes` is fetched once per session instead of on every tab visit.
- The tab panel stays inside the viewport while the IA notice is shown.
- The side-nav ratings and about dialogs no longer render underneath the
  Curriculum Map's sticky headers and course chips; the ratings backdrop now
  dims the page instead of only blurring it. (Pre-existing on `dev`.)

See `docs/adr/0002-tab-ia-group-and-retire.md` for the rationale and trade-offs.
