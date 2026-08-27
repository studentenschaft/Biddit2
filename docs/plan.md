# Phase 3 — Exam blocks in the Calendar

Builds on Phases 0–2 (ADR 0007/0008/0009). Scope: show MY courses' central
written exams as blocks in the weekly Calendar tab, plus a way to get to the
exam period (which lies outside the lecture weeks the calendar boots into).

## Assumptions & constraints

- **Written OT exams only.** Orals have no times (never fabricate — ADR 0009);
  AT rows are provisional until CW42 and bind only students granted the
  alternative date. Both stay off the calendar; Course Details covers them.
- **Do not touch `calendarEntriesSelector`.** Its output and tests pin the
  filter-leak invariant and the lecture collision logic. Exams come from a new
  selector and are concatenated in `Calendar.jsx`.
- Exam blocks must be visually distinct from lectures: base style dark
  (`hsg-800`-family, like enrolled) with an unmistakable "Exam" marker;
  a colliding exam (from `examCollisionsSelector`) turns `danger` red with
  `conflictsWith` in the tooltip — consistent with Phase 2's red = exam clash.
- Exam period (18.01.–20.02.) lies outside the calendar's derived lecture
  range: the boot-date percentile logic (`Calendar.jsx` ~96–116) must be left
  alone; instead add an "Exam period" jump. Verify navigation is not
  constrained by any `validRange` before relying on `gotoDate`.
- Saturday orals are off-calendar anyway; `hiddenDays={[0]}` (Sunday) is fine.
- Fail-open as everywhere: no plan / borrowed semester → no exam events, no
  jump button.
- The indicative-only disclaimer must appear on the exam hover tooltip and the
  mobile event sheet (same short form as Phase 2: "Indicative — verify
  officially.").
- Heatmap stays untouched (its ISO-week range cannot show the exam period —
  noted as out of scope in the ADR).

## Steps

1. **Selector** `examCalendarEventsSelector` (selectorFamily by semester) in
   `recoil/examScheduleSelectors.js`: for each root of
   `myCoursesSelector(semester)` (deduped via `getCourseRootKey`), its OT
   written exams from `examSchedulesState` become FullCalendar events:
   `{ id, title: shortName, start: startIso, end: startIso + durationMin,
   entryType: "exam", durationMin, byod, overlapping, conflictsWith, color }`.
   `overlapping`/`conflictsWith` come from `examCollisionsSelector` (reuse,
   don't recompute). Color: `#DC2626` (danger) when overlapping, else a dark
   distinct base (e.g. `#00521E` hsg-900). One event per root, not per course
   (exercise groups must not duplicate blocks).
2. **Calendar.jsx wiring**: mount `useExamSchedule(semester)`; concat exam
   events into the event set fed to FullCalendar (the `calendarKey` remount
   already handles event-set changes). Branch `renderEventContent` for
   `entryType === "exam"`: time range, title, and an "Exam" badge line instead
   of room. Extend `hoverEvent` tooltip and `CalendarEventSheet` (mobile) with
   exam fields: duration, BYOD (only when true), conflictsWith in red, and the
   disclaimer line. Keep PropTypes in sync.
3. **"Exam period" jump**: a small button beside the calendar's existing
   custom navigation, rendered only when exam events exist; `gotoDate` to the
   Monday of the first exam week (min event start). Label "Exams"; when the
   visible range is inside the exam period the button jumps back to the
   semester ("Lectures" state) — a simple toggle, no new state atoms beyond
   local component state.
4. **Tests**: selector unit tests (OT-only, no orals, per-root dedupe,
   collision coloring + conflictsWith threading, empty for missing plan);
   Calendar-side tests following the existing calendar test patterns
   (`CalendarEventSheet.test.jsx`, `calendarEventSheetGating.test.jsx`):
   exam badge rendering, sheet content incl. disclaimer, jump button presence
   gated on exam events. MSW fixture already carries colliding exams.
5. **Docs**: ADR 0010 (exams as calendar events: OT-only + no fabricated
   times, separate selector vs. touching calendarEntriesSelector, jump
   affordance vs. widening the boot range, heatmap out of scope). CHANGELOG.

## Verification

- `npm test` + `npm run lint` green; no changes to calendarEntriesSelector
  or its tests.
- Live (user session, HS26): Calendar tab → "Exams" button appears → jump →
  week of 18.01.2027 shows Advanced Cybersecurity 19.01 15:15 block (dark),
  week of 25.01 shows the two colliding 27.01 09:15 blocks in red with
  mutual conflictsWith in tooltip/sheet; button toggles back to the lecture
  weeks. The user's wishlist (incl. the two demo-collision courses) is left
  exactly as-is.

## Execution workflow

Opus 5 subagent implements → ponytail review subagent → orchestrator's own
correctness pass (tests, live check) with direct fixes → conventional commits
on `feature/exam-schedule-ingestion`.
