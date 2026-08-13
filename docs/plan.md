# Current plan

The CLAUDE.md workflow starts by writing the scope of a change down here before
any code is touched. This file points at the plan that is currently in flight or
was most recently executed.

## In flight / most recently executed

**Tab IA "Group & Retire"** — `docs/superpowers/plans/2026-08-13-tab-ia-group-and-retire.md`
(branch `feature/tab-ia-group-and-retire`).

- **Scope:** restructure the flat 7-tab right column into a grouped row —
  *This Semester* (Details · Calendar · Summary) and *My Degree* (Curriculum Map
  · Study Overview · Transcript) — fold Smart Search into the left-column course
  list as a search mode, fix the empty default view, and land the enabler
  refactors (named tab ids, `useOpenCourseDetails`, GA4 tab telemetry,
  a11y/mobile fixes).
- **Study Overview:** originally slated for deletion as self-deprecated, kept
  for this redesign at the user's request. It stays in the *My Degree* group
  with its Curriculum Map migration notice intact.
- **Explicitly out of scope:** the two-mode "Concept A" rework, deferred to a
  later `ui-revamp` branch. The enablers above exist so it can be built without
  another round of tab-navigation surgery.
- **Decision record:** `docs/adr/0002-tab-ia-group-and-retire.md`.
- **Status:** implemented; see `CHANGELOG.md` (Unreleased).

Task-level briefs and reports for this plan live in
`.superpowers/sdd/2026-08-13-tab-ia-group-and-retire/`.
