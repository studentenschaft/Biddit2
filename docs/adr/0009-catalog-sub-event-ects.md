# ADR 0009: Dependent catalog sub-events lose their ECTS at ingestion

- **Status:** Accepted
- **Date:** 2026-09-08

## Context

HSG publishes one course as several catalog events. "Methoden: Empirische
Sozialforschung" (BWL, HS26) is a 4-ECTS course listed as a 4-ECTS main event
`3,105,1.00` **plus** a 4-ECTS companion `3,105,3.00`, "Methoden: Empirische
Sozialforschung: Selbststudium". Exercise groups and coaching slots work the
same way.

Catalog ingestion (`updateAvailableCourses`) zeroed an event's credits only when
its **name** matched `exerciseGroupRegex` — Übung / Exercise / Case Studies /
Coaching. "Selbststudium" matched nothing, so the companion kept its 400
credits in `semesters[HS26].available`, and every surface reading that pool —
the course list, Course Info, and the semester summary through
`myCoursesSelector` — showed 8 ECTS for a 4-ECTS course.

The correct rule already existed. `smartExerciseGroupHandler`'s
`isLikelySubgroupByNumber` reads the course number: a third segment ≥ 2 with a
`1.xx` sibling under the same `a,b` root is a sub-event. Study overview and the
curriculum map call it through `processExerciseGroupECTS` and were already
right. Only ingestion was not.

## Options considered

1. **Add "Selbststudium" to the regex and stop there.** Rejected as the whole
   fix: it patches this one word and leaves the next companion form — whatever
   HSG names it — to be reported as another bug. The number rule is the one that
   generalises.

2. **Call `processExerciseGroupECTS` on the catalog.** Rejected. It falls back
   to base-name grouping when a course number is missing, and it carries a
   same-name dedup that keeps credits on the first of two identically named
   courses and zeroes the rest. Over ~10 of a user's own courses that is a
   useful heuristic. Over ~2000 catalog events it is a wrong answer: two
   unrelated "Kolloquium" entries from different departments would silently lose
   their ECTS.

3. **Fix it downstream, in the summary's total.** Rejected as the primary fix:
   the course list and Course Info read `available` directly, so the wrong
   number would still be on screen — just not in the total.

## Decision

A second, stricter pass lives beside the existing one in
`smartExerciseGroupHandler`:

`isDependentSubEvent(course, mainEventRootKeys)` is true when the title matches
`exerciseGroupRegex`, **or** the course number is `a,b,N.xx` with N ≥ 2 and the
catalog also lists an `a,b,1.xx` event. `processCatalogSubEventECTS` builds the
root-key index once via `buildMainEventRootKeys` (O(n), not O(n²)) and zeroes
the matches. Grouping is **strictly** by course-number root key — no base-name
fallback, no same-name dedup. Both reuse the module's existing
`getCourseRootKey` / `getThirdSegment` rather than parsing numbers a second
time; only `processCatalogSubEventECTS` is exported.

`updateAvailableCourses` runs that pass **after** flattening, because the rule
needs the whole catalog to know whether a sub-numbered event has a main event.

**An orphan companion is decided by its name.** With no `1.xx` sibling the
number rule abstains; if the title still names a companion form the credits go
to zero, because a companion is a companion whether or not its main event was
published. A sub-numbered event with a neutral title and no main event keeps its
ECTS — with nothing to be dependent on, it is a course in its own right.

`exerciseGroupRegex` gains `Selbststudium`, `Self-Study`/`Self Study` and
`Independent Studies`, matched only as a `": suffix"`. That both feeds the name
signal above and makes `ExerciseGroupDisclaimer` appear on these companions in
Course Info. The suffix anchoring is what keeps a genuine course like
"Selbststudium und Prüfungsvorbereitung" out.

## Consequences

- Two passes with deliberately different grouping rules now coexist.
  `processExerciseGroupECTS` is the *my-courses* pass (small set, name fallbacks
  allowed); `processCatalogSubEventECTS` is the *catalog* pass (large set,
  identifiers only). Neither may be swapped for the other.
