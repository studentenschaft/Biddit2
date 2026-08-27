# Phase 2 — "Does my course exam overlap?"

Builds on Phase 0 (ingested `app/public/exams/<SEMESTER>.json`, ADR 0007) and
Phase 1 (runtime consumption + CourseInfo display, ADR 0008).
Scope: collision detection among MY courses' central exams + warnings in the
existing per-course surfaces. No calendar exam blocks (Phase 3).

## Assumptions & constraints

- Collision semantics: two exams collide iff same `date` **and** same `slot`.
  All written exams start 09:15 or 15:15 and no morning exam reaches the
  afternoon slot (max 180'), so interval math is unnecessary — group-by
  (date, slot) is exact, simpler than reusing the lecture UnionFind, and the
  ADR records why.
- Only **OT** written exams produce warnings. AT rows are provisional until
  the CW42 re-ingest and only apply to students granted the alternative date.
  Oral exams have no times, so they never produce collision claims.
- Course pool: `myCoursesSelector(semester)` (enrolled ∪ selected) — the same
  pool the lecture-overlap feature uses; NEVER the `filtered` view state
  (documented filter-leak bug).
- Dedupe by root key: a lecture and its exercise groups share one exam and
  must not collide with themselves. One warning per root, listing the OTHER
  courses' `shortName`s.
- Fail-open as in Phase 1: no plan / borrowed semester → no warnings at all.
- Artifact schema unchanged → `schemaVersion` stays 1.

## Steps

1. **Centralize the borrowed-data gate.** Move the
   `isFutureSemester || usingReferenceData` check from `ExamSchedule.jsx`
   into `useExamSchedule(semester)` itself (it reads
   `semesterMetadataSelector` internally; passing a semester whose data is
   borrowed behaves like `null`). Phase 2 adds more call sites; each must not
   re-implement the guard. `ExamSchedule.jsx` drops its local check.
2. **Pure collision finder** in `helpers/examScheduleUtils.js`:
   `findExamCollisions(plan, courses)` → `Map<rootKey, { exam, conflictsWith: string[] }>`
   — OT written exams of the deduped roots of `courses`, grouped by
   `(date, slot)`; groups with ≥2 distinct roots become collisions;
   `conflictsWith` carries the other roots' course `shortName`s (first course
   per root wins for naming). Unit-testable without React.
3. **Selector** `examCollisionsSelector` (selectorFamily keyed by semester) in
   `recoil/examScheduleSelectors.js`: reads `examSchedulesState` +
   `myCoursesSelector(semester)`, returns the Map (empty when no plan).
   Note: selectors only READ the atom — fetching stays in `useExamSchedule`,
   so every surface that shows warnings must also mount the hook once at
   container level.
4. **Surfaces** (all subscribe to the selector; follow the WORKING overlap
   pattern — `LockOpen.jsx`-style subscription — not the dead
   `course.overlapping` field):
   - **Course list** (`leftCol/bottomRow/EventListContainer.jsx` row): a small
     warning icon (existing `text-warning` color #FCA311, distinct from the
     lock) shown only when the row's root has a collision, with a
     react-tooltip listing "Exam overlaps with: X, Y". Mount
     `useExamSchedule(selectedSemester)` once in the container.
   - **SemesterSummary** (`rightCol/SemesterSummary.jsx`): extend the
     existing conflict tooltip machinery with an "Exam overlap: …" line,
     visually distinct from lecture overlaps. Mount the hook once here too.
   - **CourseInfo** (`rightCol/ExamSchedule.jsx`): on the affected written-exam
     row, a warning line "Overlaps with <shortNames>" in `text-warning`.
5. **Tests.** Vitest: collision-finder unit tests (collision, no collision,
   same-root exercise group NOT colliding, cross-listed exam colliding with a
   third course, AT/oral excluded, empty inputs); selector test with seeded
   atom state; one rendering test per surface (icon appears only for
   colliding row; tooltip content; ExamSchedule warning line). Extend the MSW
   exam fixture with two OT exams sharing a (date, slot) — bump fixture, not
   schema.
6. **Docs.** ADR 0009 (collision semantics: same-slot grouping over interval
   math, OT-only, root-dedupe rationale); CHANGELOG entry.

## Verification

- `npm test` + `npm run lint` green.
- Live in the dev server (user session): wishlist a course that shares
  19.01.2027 15:15 with enrolled Advanced Cybersecurity (e.g. 7,354 Data
  Analytics and Causal Inference), confirm the warning icon + tooltip in the
  course list, the SemesterSummary line, and the CourseInfo warning; then
  remove the course from the wishlist again (leave the user's plan as found)
  and confirm the warnings disappear.

## Execution workflow

Opus 5 subagent implements → ponytail review subagent → orchestrator's own
correctness pass (tests, live check) with direct fixes → conventional commits
on `feature/exam-schedule-ingestion`.
