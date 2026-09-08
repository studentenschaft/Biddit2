# ADR 0008: Saved courses are scoped to the current programme's era

- **Status:** Accepted
- **Date:** 2026-09-08

## Context

A student who used Biddit through a Bachelor and is now in a Master saw courses
he had saved in HS22 and FS23 sitting inside his **Master** scorecard categories
("Contextual Studies", "Managerial Impact Project"), with today's names, 4 ECTS
and an open lock — as if he had planned them for this degree.

Nothing in the data says otherwise. `GET /study-plans` returns saved courses
keyed by semester short name alone (`{"HS22": [...], "FS23": [...]}`) — no
programme, no degree level. `studyOverviewViewSelector` then unions every
semester and hands its `selectedIds`/`enrolledIds` to whichever programme is
"main", and `getAvailableCoursesWithFallback` enriches a semester that has no
catalogue of its own from the **current** one, so an old ID borrows today's
`shortName`, `credits` and `classification` — which is what routes it into a
Master category.

ADR 0006 made these entries removable and explicitly left them visible; this is
the follow-up that stops them being mis-attributed.

## Options considered

1. **Tag saved courses with a programme at write time.** Correct in principle,
   impossible today: the API stores a semester and a course ID, nothing else,
   and historical rows cannot be back-filled.
2. **Filter by degree level.** Rejected: the saved ID carries no level either,
   and inferring one from the current catalogue repeats the borrowed-data
   mistake in a new place.
3. **Show pre-era courses in a separate "earlier studies" block.** A reasonable
   product answer, but a UI decision, and `feature/transcript-overhaul` is
   rebuilding this surface. Deliberately not built here.
4. **Scope by semester era (chosen).** The one fact both sides really have is a
   date: scorecard items carry a semester, and so do saved courses.

## Decision

`helpers/programEraScope.js` is a pure module — no Recoil, no React — answering
which semesters belong to the programme the student is in now.

**The era rule**, in order:

1. The **earliest** semester carried by the main programme's own scorecard items
   (completed or enrolled).
2. If it has no dated items yet — a fresh Master student — the semester **after**
   the latest dated item of any other programme (a Bachelor ending FS26 puts the
   Master's era at HS26).
3. Otherwise `null`, meaning *unknown*: nothing is scoped, which is the previous
   behaviour. Unparseable semester keys are likewise kept, never hidden.

Ordering and parsing reuse `parseSemesterKey` / `compareSemesters` /
`getNextSemesterKey` from `curriculumPlanAtom`; no second semester parser was
written. FS sorts before HS inside a year (FS26 < HS26 < FS27).

`studyOverviewViewSelector` applies the window: only semesters inside the era
contribute `selectedIds`/`enrolledIds` to the **main** programme's planned rows.
Other programmes keep their own enrolments untouched — they are already dated by
their own scorecard. That single point is enough: the Transcript's wishlist is
derived from this selector, so it needs no guard of its own.

**`feature/transcript-overhaul` must apply the same scoping in its
`mainProgramPlannedCoursesSelector`.** That selector reads the semesters
directly instead of going through `studyOverviewViewSelector`, so without the
guard it reintroduces this bug verbatim. The hook-in is one line:
`isSemesterInProgramEra(semesterKey, deriveMainProgramEraStart(programs, mainProgramId))`.

## Consequences

- Courses saved before the current programme no longer render inside its
  categories.
- They are **not deleted**. They remain on the server, and "Clear All Saved
  Courses" still reads the study plans unfiltered (ADR 0006) — it is the escape
  hatch for exactly the entries the normal UI cannot reach, so scoping it would
  defeat its purpose.
- Until the overhaul lands there is no UI that shows pre-era saved courses. That
  is the accepted cost of not building a throwaway "earlier studies" block.
- A student whose main programme has no dated items *and* no other programme
  (a first-semester student before any grades) is scoped by nothing, as before.
