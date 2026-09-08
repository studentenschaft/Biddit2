# ADR 0007: Curriculum map category resolution and enrolled-course category overrides

- **Status:** Accepted
- **Date:** 2026-09-08

## Context

A MiQEF student bid on "Skills: Julia – A Fresh Approach…" (3 ECTS). The
Curriculum Map filed it under *Core Studies → Compulsory Subjects* — the worst
possible bucket, because it inflates compulsory progress — and the card could not
be moved, so there was no way to correct it.

Two independent defects:

1. **Resolution.** `matchClassificationToCategory` only searched the *leaves*
   flattened for the grid, and `extractClassifications` had no skills/competence
   keywords. A classification naming a grouping node ("Contextual Studies") was
   therefore unreachable, and every miss fell through to `flatCategories[0]`,
   which is Compulsory Subjects in most scorecards.
2. **No correction path.** Enrolled (bid) cards were not draggable, and their
   category was recomputed from the classification on every render, so even a
   drag would have had nowhere to persist to.

## Options considered

1. **Store the override in a new field on the plan document.** Rejected: the
   curriculum-plans backend (`api.shsg.ch/curriculum-plans`) accepts only
   `name, placements, semesterNotes, wishlistOverrides`, and we cannot deploy a
   backend change for this fix.
2. **Allow enrolled cards to move freely (semester included).** Rejected: an
   enrolment is bound to the semester it was bid in. A card that appears to move
   to another semester would misrepresent the student's actual registration.
3. **Widen the keyword table until the Julia course matched.** Rejected on its
   own: the table is a heuristic over an open-ended catalog, so the structural
   problems (ancestors unreachable, hostile fallback) would remain for the next
   course.

## Decision

**Resolution order** (`resolveCategoryForCourse`), applied in the wishlist,
enrolled and plan-item passes alike:

1. exact leaf-name match on the classification;
2. the classification names an *ancestor* (grouping node) with exactly one leaf
   → that leaf;
3. the ancestor is ambiguous → the course-name category prefix (text before the
   first `:`, at most three words — HSG names courses "Skills: …", "Area of
   Concentration: …") as tiebreaker, **restricted to the leaves under that
   ancestor** ("Skills" → a skills/kompetenz leaf, else the focus-area leaf;
   other prefixes → exact name, then keyword);
4. the ancestor is ambiguous and the prefix does not discriminate → best effort
   among its leaves (name contained in the classification, then keyword, then
   the first leaf);
5. keyword/substring match against a leaf's `validClassifications` (now
   including a skills/competence pattern);
6. the course-name prefix over *all* leaves, when nothing above matched at all;
7. `resolveFallbackCategory`: a leaf that accepts electives, else the last leaf,
   else the first — never silently the compulsory column. The DEV warning stays.

**The ancestor named by the API classification outranks the course-name prefix.**
The classification is what the university says about the enrolment; the prefix is
a naming convention. So a course classified "Core Studies" and named "Skills: …"
stays under Core Studies (steps 3–4 never leave the ancestor) — the prefix only
disambiguates *within* the classified group, and reaches other parts of the tree
only when the classification matched nothing (step 6).

Leaves flattened for the grid now carry their `ancestors`, which is what makes
step 2 possible without passing the whole hierarchy around.

**Overrides reuse the existing placement.** When an enrolled course has a
`course-<id>` placement in the same semester whose `categoryPath` is a real grid
row, that path wins over any inference; the card stays `status: "enrolled"`,
`source: "enrolled"`, and the plan-item pass skips the course so only one card is
rendered. Enrolled cards are draggable (only completed stays locked) but not
removable, and `moveCourse` rejects a cross-semester drop with a toast rather
than silently doing nothing.

## Consequences

- A student can re-file a bid course and it survives a reload, with no backend
  change: the correction is an ordinary placement.
- A placement now means "where this course belongs", for planned *and* enrolled
  courses. `usePlanManager.importSelectedCourses` still writes a raw
  `classification` as `categoryPath` (rescued by the plan pass's name match);
  that type confusion is left for a follow-up, out of scope here.
- Unresolved courses land in an elective bucket, which under-reports compulsory
  progress instead of over-reporting it — the safer direction for a student
  reading the map.
