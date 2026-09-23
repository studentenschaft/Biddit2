# ADR 0011: The app loads the exam plan as a static asset, for the selected semester only

- **Status:** Accepted
- **Date:** 2026-08-27, revised 2026-09-23

## Context

ADR 0010 ships `app/public/exams/<SEMESTER>.json` for the semesters someone
ingested (HS26 today). The app shows those dates in Course Details and the
Calendar and checks them for clashes (ADR 0012). It must never attach a date to
the wrong term, and a student must be able to tell "checked, no clash" from
"not checked". Three facts shape the design: the file exists only for ingested
semesters; it prints two-segment roots (`3,200`) where the app carries full
course numbers (`3,200,1.00`); and a borrowed catalog — a reference-semester
preview or a projected future term (`helpers/REFERENCE_SEMESTER.md`) — lists
courses that are not running in the term on screen.

## Decision

**A static, same-origin asset outside `apiClient`.** The plan is fetched with a
plain `fetch("/exams/<SEMESTER>.json")`. `apiClient` exists to authenticate
against the SHSG and UniSG APIs and to renew sessions; a public static file
needs neither, and trouble with those APIs must not take the exam dates down
with it. The plan is not bundled either, which would ship every ingested
semester to every user. Any later call on this path must stay same-origin and
unauthenticated, or it belongs in `apiClient`.

**One load per semester and store.** `examPlanState` is a Recoil `atomFamily`
whose effect fetches on the first read, so a semester loads once per store and
a remount (react-tabs unmounts Course Details on every tab switch) does not
refetch. It is not an async selector: Recoil's selector cache is global across
`RecoilRoot`s and cannot hold an explicit error. The value is
`{ status, plan }`:

- `loading` until the fetch settles;
- `ready` with a plan this code understands;
- `none` when there is no plan: a non-OK response, or one that is not JSON
  (the Vite dev server answers a missing file with `index.html` and a 200);
- `error` for a network failure, unparseable JSON, or an unsupported
  `schemaVersion` or shape. There is no retry.

**Validated once, at load.** The loader accepts `schemaVersion` 2 with `written`
and `oral` arrays. Entry-level integrity is the CLI's job, which refuses to
write a bad artifact (ADR 0010), so nothing downstream re-checks the plan.
`schemaVersion` stays because a tab left open across a deploy meets new
artifacts with old code: that tab shows `error`, not a half-understood plan.

**One gate, judged on the selected semester.** Every consumer reads
`examPlanSelector(semester)`. It returns `none` without reading the atom — so
without fetching — when `semesterMetadataSelector(semester)` reports
`isFutureSemester || usingReferenceData`, and it re-evaluates when that flips.
The semester passed is always the one on screen. The Calendar, the course list
and the Summary pass the selected semester. Course Details passes it only when
the course's own semester (its cisId lookup) and, when the Curriculum Map
opened it, the card's semester both equal the selected one: a projected
semester reuses its reference semester's cisId, so the course alone cannot
tell HS26 from HS27. Any mismatch shows no dates.

**Joined on the root; OT written exams only.** A course matches the exams that
list its two-segment root (`getCourseRootKey`), so an exercise group inherits
its lecture's exam and every listing of a cross-listed exam finds it. Written
exams are the OT rows, because the AT rows of the current PDF belong to the
previous semester (ADR 0010). An oral exam shows its date range and "individual
time published in Compass" and is never drawn in the Calendar. The Calendar
draws one block per written exam of the user's courses, and an "Exams" button
jumps to the exam weeks and back.

**Unavailable is said, not implied.**

- Course Details lists each exam with date, time, duration and
  "digital (BYOD)" when marked. A decentral-only course says the lecturer
  schedules it, whatever the plan's status. On `error` it says the dates could
  not be loaded. When a ready plan does not list a central course, or a course
  without a usable number, it says the date was not found and points to the
  official plan; any other unlisted course reads "Not in the central exam
  schedule". Loading, `none` and borrowed semesters show nothing.
- Once the plan has settled, the Semester Summary ends with an "Exam check"
  line: the result, or "unavailable" with the reason for `none` and `error`.
- Both name their source, the plan's term label and publication date, and
  every surface that shows an exam date carries the "indicative — verify
  officially" disclaimer (ADR 0012).

## Consequences

- Clash warnings fail open: without a ready plan there are none, and the
  Summary's exam-check line is what tells the student so.
- A stale artifact is not detected. The source line lets a user notice.
- BYOD is present-or-silent: the UI shows "digital (BYOD)" when marked and
  never "not BYOD".
