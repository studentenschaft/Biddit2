# ADR 0008: The app reads the exam-schedule artifact as a static, fail-open asset

- **Status:** Accepted
- **Date:** 2026-08-27

## Context

ADR 0007 put the HSG central exam plan into the repository as
`app/public/exams/<SEMESTER>.json`. Nothing read it. This ADR covers Phase 1:
showing those dates in Course Details. Display only — no overlap detection, no
calendar events.

Three properties of the artifact shape the design. It exists for exactly the
semesters someone ingested by hand (HS26 today). It prints two-segment course
roots (`3,200`) where the app carries full course numbers (`3,200,1.00`). And it
is a file in `public/`, not an API response.

## Options considered

1. **Fetch through `apiClient`.** Rejected. `apiClient` exists to attach
   Entra tokens, classify 401s into session-renewal events, and enforce the
   SHSG kill switch. A same-origin static file needs none of that, and routing
   it through the kill switch would take the exam dates down during an incident
   that has nothing to do with them. This is a deliberate, narrow exception to
   the "always use `apiClient`" rule, and it holds only because the asset is
   same-origin, unauthenticated and not `api.shsg.ch`.

2. **Bundle the JSON with an `import`.** Rejected: it would ship every
   ingested semester's plan to every user in the main chunk and force a redeploy
   to be re-fetched, while buying nothing over a cached static request.

3. **Match on the full course number.** Rejected — it cannot work. The PDF
   prints roots, so the join has to happen at the root. The root join is also
   what makes an exercise group inherit its parent lecture's exam for free,
   which is correct: they sit the same exam.

4. **Show a "could not load exam dates" state.** Rejected. For most
   semesters the file legitimately does not exist. An error state would be
   permanently wrong for them and would teach users to ignore it.

## Decision

`useExamSchedule(semester)` fetches `/exams/<semester>.json` with a plain
`fetch`, once per semester per session, and caches the outcome in
`examSchedulesState` as `{ status: "loaded" | "missing", plan }`. The atom is the
fetch guard: Course Details is unmounted by react-tabs on every tab switch, so a
component-local guard would not survive.

**Every failure is `missing`.** A 404, unparseable JSON, a network error, or a
`schemaVersion` the app does not recognise all end in the same terminal state,
and `missing` renders nothing. There is no retry: a static asset that is absent
will not turn up on a second try. `schemaVersion` is checked rather than
trusted, so a future artifact shape degrades to silence instead of rendering
half-understood fields.

**Borrowed catalogs never show exam dates.** When the displayed courses come
from a reference semester — `isFutureSemester || usingReferenceData`, the
predicate from REFERENCE_SEMESTER.md — `ExamSchedule` passes `null` to the
loader and renders nothing. Those courses are not running in the selected term,
so any date attached to them would belong to a different exam period. This is
the same guardrail `similarCoursesApi.js` applies to the vector DB.

**The matcher is a pure function.** `examsForCourse(plan, course)` in
`helpers/examScheduleUtils.js` takes the plan as an argument and knows nothing
about React, Recoil or fetching, so the join rules are unit-testable on their
own. `getCourseRootKey` moved from `smartExerciseGroupHandler.js` into
`courseUtils.js` for it — the deferred Phase-0 lift now has its runtime
consumer.

**A decentral-only course short-circuits.** It is not in the central plan by
definition, so it gets "scheduled by the lecturer" instead of a lookup and a
misleading absence.

## Consequences

- **BYOD is present-or-silent.** ADR 0007 established `byod` as a lower bound,
  so the UI badges a digital exam when the flag is set and says nothing when it
  is not. It must never render "not BYOD".
- **AT rows are labelled, not hidden.** The alternative-date plan is incomplete
  until the CW42 re-ingest, so AT entries sort after the ordinary date and carry
  an "Alternative date" label.
- **A stale artifact fails silently.** Nothing compares `publishedAt` against
  the calendar. The source footnote (term label + publication date) is what lets
  a user notice, which is why it is rendered rather than dropped as clutter.
- **The exception has to be defended.** Any future call added to this path must
  stay same-origin and unauthenticated, or it belongs in `apiClient`.
