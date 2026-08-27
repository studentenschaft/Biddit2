# ADR 0009: Exam collisions are same-slot groupings of ordinary-date exams

- **Status:** Accepted
- **Date:** 2026-08-27

## Context

Phases 0/1 (ADR 0007/0008) put the central exam schedule into the app and onto
the Course Details panel. Phase 2 warns a student when two of *their* courses —
enrolled or wishlisted — sit exams that cannot both be attended. The exam-plan
PDF itself tells students they alone are responsible for avoiding such
collisions; this feature automates that check, so its failure modes matter: a
missed warning costs a student an exam.

The app already has collision machinery for lectures: `calendarEntriesSelector`
runs a Union-Find over pairwise interval intersections of `(eventDate,
durationInMinutes)` entries. The obvious move was to reuse it.

## Options considered

1. **Reuse the calendar Union-Find with synthesized exam entries.** Rejected.
   Every written exam in the plan starts at exactly 09:15 or 15:15, and the
   longest exam (180') ends 12:15 — no morning exam can reach the afternoon
   slot. Interval intersection therefore degenerates to "same date, same
   slot", and pushing exams through the calendar pipeline would buy generality
   nothing in the data can exercise, at the cost of coupling exam warnings to
   a selector with a documented false-positive TODO.
2. **Warn on alternative-date (AT) and oral exams too.** Rejected. The AT plan
   is explicitly provisional until the CW42 revision and binds only students
   granted the alternative date; oral exams publish no times at all
   ("individual slots in Compass"). A warning built on either would be a
   guess, and a wrong overlap warning teaches users to ignore the right ones.
3. **Collide on full course numbers instead of roots.** Rejected. A lecture
   (`3,200,1.00`) and its exercise group (`3,200,2.04`) share one exam; keyed
   by full number they would "collide" with each other on every course that
   has groups.

## Decision

A pure `findExamCollisions(plan, courses)` groups the OT written exams of the
user's courses (enrolled ∪ selected via `myCoursesSelector`, deduped to
two-segment roots) by `(date, slot)`. Any group with two or more distinct roots
is a collision; each root gets one warning naming the other roots' courses.
`examCollisionsSelector` exposes the map per semester, reading only the atom
that `useExamSchedule` fills — the borrowed-data gate lives inside that hook,
so no surface can show warnings for reference-semester catalogs. Warnings
surface in the course list rows, the semester summary and the Course Details
exam block, each carrying an "indicative — verify officially" disclaimer:
the data is extracted from a PDF by us, not published by the university.

## Consequences

- The collision rule is exact for every plan the university has published, but
  it assumes the two-slot structure. If a future plan introduces a third slot
  or free-form times, the ingest parser fails loudly first (column-boundary
  detection and the `E_UNCONSUMED_LINE` residue check) — the app-side rule can
  then be revisited.
- AT-only collisions are invisible by design; students on alternative dates
  must still check by hand. The CW42 re-ingest does not change this.
- A student sees at most one warning per course, from its first colliding
  slot. Multiple same-course collisions collapse into one `conflictsWith`
  list per slot; nobody has to count warnings to count problems.
- The warning icon in the course list only appears for courses already in the
  user's plan — a merely browsed course is not yet competing for the slot.
