# ADR 0006: Saved-course removal reads from the server, not from app state

- **Status:** Accepted
- **Date:** 2026-08-25

## Context

Wishlist courses saved in a past semester could not be removed by any means: the
Transcript's lock button was inert and "Clear All Saved Courses" always answered
"No saved courses found to clear." The left column only shows the currently
selected semester, so the Transcript was the only removal path for an old entry.
See the CHANGELOG for the three defects.

## Options considered

1. **Pass `event={subItem}` to `LockOpen`** so it toggles itself. **Rejected, and
   worth recording because it looks correct:** `LockOpen` resolves selection
   through `selectedCoursesSelector(selectedSemesterShortName)` — the *currently
   selected* term. For a course saved in FS23 while the UI sits on HS25 it
   computes `isCourseSelected === false` and **re-adds** the course. Only
   `GradeTranscript`'s own `useCourseSelection` is semester-aware, via
   `course.semester`.

2. **Duplicate the lock as an inline `<svg>`.** Rejected: a fourth hand-rolled
   copy of the same icon, and it discards the colour logic.

3. **Rebuild clear-all from `unifiedCourseData.semesters[*].studyPlan`.**
   Rejected: that data is filtered (`/^[A-Z]{2,3}\d{2}$/` semester keys, strict
   course-id shape). Clear-all is the escape hatch for exactly the entries the
   normal UI cannot reach, so filtering defeats its purpose. Bogus plan keys 404
   harmlessly; that is cheaper than leaving a user with undeletable courses.

## Decision

`LockOpen` calls `stopPropagation()` only once it knows it owns a toggle; with no
`event` it is a plain icon and the click bubbles to the wrapping button.

Clear-all reads the server unfiltered, via `helpers/clearSavedCourses.js`.

**Failures are never reported as emptiness.** `getStudyPlan` throws instead of
returning `[]`, and no longer reports the error itself — the caller decides, so
the user gets one error UI rather than a toast plus an alert. `deleteCourse`
still swallows per-course errors (callers delete speculatively under several id
formats, so 404s are expected) but returns a boolean and takes
`{ reportErrors }`, which the bulk wipe sets to `false`: 40 failed deletes during
an outage would otherwise stack 40 non-dismissing toasts.

`studyPlanAtom`, `useStudyPlanData` and `currentStudyPlanIdAtom` are deleted
rather than rewired. Leaving the corpse that caused the bug invites it back.

## Consequences

- `getStudyPlan` throws; its only surviving caller is `clearSavedCourses`.
- Old saved courses still *appear* across all semesters in the Transcript. That
  is the intended cross-semester view — the fix is that they can be removed.
  Hiding pre-enrolment semesters would be a product decision, not a bug fix.
- `Transcript` suspends on `cisIdListSelector` (async), so any test rendering it
  needs a `<Suspense>` boundary.
