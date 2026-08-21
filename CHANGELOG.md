# Changelog

All notable changes to this project are documented in this file as per August 2026.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Mobile: tap on a calendar event opens a bottom sheet with the full course
  name, time, room and conflicts (desktop keeps the hover tooltip).
- Mobile: the side nav opens as a labeled overlay drawer (Rate courses ·
  About · Privacy · Analytics settings · Contact · Log out) with a dimmed
  tap-to-close backdrop; the desktop icon rail is unchanged.
- Mobile: tab row shows edge fades with chevron buttons when tabs overflow,
  auto-scrolls the selected tab into view, and carries inline group labels.
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
- GA4 events for the remaining core interactions: `column_switch`,
  `wishlist_change`, `wishlist_cleared` and `semester_switch`.
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
- `tab_select` is emitted from a `selectedTabAtom` effect instead of the
  react-tabs click handler, so it now also covers programmatic tab changes and
  the tab a session lands on (`from: null`).
- Curriculum Map is sticky-mounted: it mounts on first visit and stays mounted,
  so its state survives tab switches (scroll position does not).
- Tab focus ring is delivered via Tailwind `focus-visible:` utilities; the
  vendor react-tabs stylesheet imports were dropped.
- On mobile the tab row scrolls horizontally with edge-fade chevron
  affordances, and compact group labels ride inline with the row instead of
  the desktop headings.

### Removed

- **Smart Search tab** — replaced by the left-column search mode above. Smart
  results no longer offer the per-result category/credits dropdown filters.

### Fixed

- Curriculum Map: category rows honour per-category **minimum** credits.
  Previously only a parent's total was checked, so *Core Studies* showed
  55/54 as complete even though *Basic Courses* sat at 9 against a minimum of
  12. Leaf headers now show the full requirement range (`9 / 12–27 ECTS`),
  credits earned beyond a category's maximum no longer count toward its parent
  and are surfaced as a `+N` badge, and categories with no requirement at all
  are no longer permanently green.
- Mobile: calendar day columns regain usable width (compact toolbar replaces
  the flanking nav columns below 768px, gutters reduced).
- Mobile: Review and About dialogs fit the screen (responsive widths,
  single-column grids, always-visible sticky close button, max-height with
  scrolling via the shared `AppDialog` shell).
- Mobile: Semester Summary "Events"/"ECTS" headers no longer overlap; ECTS
  values render without trailing zeros (6 instead of 6.00).
- Cookie notice wrapper no longer intercepts taps outside the visible card.
- Calendar `hiddenDays` was passed as a string instead of an array.
- Clicking a smart-search result opens Course Details, and adding one to the
  wishlist persists (both were broken in the old Smart Search tab).
- The full course catalog is only upserted to the vector DB when the query
  returns an explicit empty ids list, never when the response omits `ids`.
- `ExaminationTypes` is fetched once per session instead of on every tab visit.
- The tab panel stays inside the viewport while the IA notice is shown.
- The side-nav ratings and about dialogs no longer render underneath the
  Curriculum Map's sticky headers and course chips; the ratings backdrop now
  dims the page instead of only blurring it. (Pre-existing on `dev`.)
- Opening a course no longer crashes Course Details when the course sheet
  arrives before the `ExaminationTypes` lookup. The exam-type cell falls back to
  an em dash until the lookup lands, and for parts whose type id is missing from
  it. (Latent on `dev`, where Course Details was the default tab and had already
  loaded the lookup long before any course could be clicked.)
- Pageviews were counted twice — gtag's own `send_page_view` fired on config
  on top of the app's manual pageview; `page_view` is now sent once per
  navigation.
- Dev servers, localhost and the `dev-biddit.netlify.app` preview no longer
  report into the production property; analytics is gated on a production
  build *and* the `biddit.app` hostname (the invalid `debug: true` init option
  is gone).
- GA4 initializes only after MSAL reports `InteractionStatus.None`, and every
  hit carries a `page_location` rebuilt from origin + pathname — an OAuth
  authorization code or query string can never reach analytics. All analytics
  goes through the single `helpers/analytics.js` adapter (`react-ga4` is not
  imported anywhere else); events emitted before init are queued and flushed
  in call order.
- Deselecting a course from the course list no longer runs the removal twice
  (the lock icon's `mousedown` and the surrounding button's `click` both
  called `addOrRemoveCourse` — one duplicate delete request per deselect, and
  it would have double-counted `wishlist_change` removals).

**On deploy day:** register the GA4 custom definitions the same day — they are
not retroactive. Event-scoped dimensions `from`, `to`, `source`, `action`,
`semester`, `previous_semester`, `column`, `classification`; numeric custom
metrics `credits`, `count`; user-scoped dimension `app_version`.
`course_number` stays unregistered by design (cardinality; use BigQuery or
DebugView). Smoke-check in DebugView on `biddit.app`: exactly one `page_view`
per navigation, session starts with `page_view` then
`tab_select { from: null, to: summary }`, `page_location` never contains
`#code` or `?` on any event, and dev hosts emit nothing.
