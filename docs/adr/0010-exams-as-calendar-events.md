# ADR 0010: Written exams are calendar events from a separate selector

- **Status:** Accepted
- **Date:** 2026-08-27

## Context

Phases 0–2 (ADR 0007/0008/0009) ingest the central exam plan, show a course's
exam dates in Course Details and warn about same-slot collisions. What a
student still could not do is *see* the exams next to the rest of their
schedule. The weekly Calendar is the obvious place, but two things make it
awkward: the exam period (18.01.–20.02.) lies weeks after the last lecture the
calendar boots into, and `calendarEntriesSelector` — which builds the lecture
events — carries the filter-leak invariant
(`docs/BUG-calendar-entries-filter-leak.md`) and the lecture Union-Find, both
pinned by tests.

## Options considered

1. **Synthesize exam rows into `calendarEntriesSelector`.** Rejected. Exams do
   not come from `calendarEntry` rows, must not join the lecture Union-Find
   (their collisions are already decided by `findExamCollisions`, ADR 0009) and
   would need a second colour rule inside a selector whose output is pinned by
   the filter-leak tests. A sibling selector concatenated in `Calendar.jsx`
   keeps that contract untouched.
2. **Widen the calendar's boot range so the exam weeks are reachable by
   paging.** Rejected. The opening week is derived from the 5th/95th percentile
   of the lecture events; feeding exams into that sample drags the calendar off
   the semester on first open, which is the view 100% of users want and the exam
   period is the view they want twice a term. A jump button costs one control
   and leaves the boot logic alone.
3. **Render oral and alternative-date exams too.** Rejected, same reason as
   ADR 0009: orals publish no time ("individual slots in Compass") and AT rows
   are provisional and bind only students granted the alternative date. Drawing
   a block implies a time we do not have. Course Details still lists both.

## Decision

`examCalendarEventsSelector(semester)` turns the user's OT written exams into
FullCalendar events (`entryType: "exam"`, `start` from the plan's `startIso`,
`end` from `durationMin`), keyed by exam id so a lecture and its exercise groups
— which share a root and therefore one exam — draw a single block. It threads
`conflictsWith` from `examCollisionsSelector` rather than
recomputing it, and colours a block `hsg-900` (`#00521E`) normally,
`danger` (`#DC2626`) when it collides — the same red the Phase 2 surfaces use.
Like every exam surface it only reads the atom `useExamSchedule` fills, so a
missing plan or a borrowed catalog yields no blocks.

`Calendar.jsx` mounts `useExamSchedule`, concatenates the two event sets for
FullCalendar only, and renders an "Exam" badge where a lecture shows its room.
The hover tooltip and the mobile event sheet add duration, a BYOD badge when
the plan marks it, the clashing courses in red and the
"Indicative — verify officially." disclaimer. An "Exams" button beside the
existing navigation jumps to the Monday of the first exam week and toggles back
to the week the user left; it is absent when there are no exam blocks.

## Consequences

- The boot-date percentile sample stays lecture-only by construction: exam
  events are added to the FullCalendar `events` prop, never to the effect that
  computes the opening week and the Start/End targets.
- The calendar's empty state and loading flag also stay lecture-only. A user
  whose planned courses have exams but no lecture entries sees "select some
  courses first" and no exam blocks. This needs a semester with a real catalog
  but no calendar entries, which is the case borrowed data already excludes.
- The Heatmap is unchanged. Its ISO-week grid describes a typical week and has
  nowhere to put a one-off date in February; showing exams there was dropped.
- Cross-listed exams (one entry, several roots) draw one block titled after the
  first of the user's courses that matches. Two different courses sitting the
  literally same exam is the rare case; one block is the honest picture.
- The jump's "am I in the exam period" test is `current date >= first exam
  Monday`, which is exact only because exams always follow the lectures. A plan
  with exams *before* the semester would keep the button in its "Lectures"
  state; nothing in the published plans does this.
