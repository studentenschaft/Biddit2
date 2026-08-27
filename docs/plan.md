# Phase 1 — Show exam dates in Course Details

Consumes the Phase-0 artifact (`app/public/exams/<SEMESTER>.json`, ADR 0007) in the app.
Scope: display only. No overlap detection (Phase 2), no calendar events (Phase 3).

## Assumptions & constraints

- Artifact exists only for semesters that were ingested (HS26 today). A missing
  file means the feature is silently off for that semester — never an error.
- The PDF prints two-segment course roots (`3,200`); app course numbers are
  `3,200,1.00`. Join via root key; exercise groups share the parent's root and
  therefore its exam.
- Borrowed catalogs (reference-semester preview, `usingReferenceData` /
  `isProjected`) must never show exam dates — the courses aren't really in that
  term (guardrail precedent: `similarCoursesApi.js`).
- `byod` is a lower bound (most shaded PDF rows are lost) → UI may say
  "digital (BYOD)" when true but must say nothing when absent.
- AT rows are provisional until the CW42 re-ingest → label as alternative date.
- Static-asset fetch from `public/` deliberately bypasses `apiClient`
  (documented exception, same as `app-status.json`); it carries no auth and
  must not be subject to the SHSG kill switch.

## Steps

1. **Lift the root-key helper.** Move `getCourseRootKey` from
   `app/src/components/helpers/smartExerciseGroupHandler.js` (module-private)
   into `courseUtils.js` as an export; re-import it in
   `smartExerciseGroupHandler.js`. Behavior unchanged; existing tests stay green.
2. **Schedule state.** `recoil/examScheduleAtom.js`: `examSchedulesState`,
   default `{}` — `{ [semester]: { status: "loaded"|"missing", plan } }`.
3. **Loader hook.** `helpers/useExamSchedule.js`: per-semester fetch-once guard
   (pattern: `examinationTypesFetchGuard`), plain `fetch("/exams/<sem>.json")`;
   404 / parse error / `schemaVersion !== 1` → `missing` (fail-open). No retry
   loop — it's a static asset.
4. **Pure matcher.** `helpers/examScheduleUtils.js`:
   `examsForCourse(plan, course)` → `{ written: [...], oral: [...] }` via root
   key, OT sorted before AT. Unit-testable without React.
5. **UI.** New `rightCol/ExamSchedule.jsx` rendered inside CourseInfo's
   existing "Exam Information" section (above the `examinationParts` grid):
   - written: weekday + date, slot time, duration, OT; AT rows as
     "Alternative date"; BYOD badge only when `byod === true`
   - oral: date (or oral period) + "individual time published in Compass"
   - decentral-only course (`isDeCentral && !isCentral`): "Decentral exam —
     scheduled by the lecturer", no lookup
   - central course with loaded plan but no match: "Not in the central exam
     schedule" (neutral wording)
   - plan missing / borrowed semester: render nothing
   - source footnote: term label + publishedAt from the artifact
   - while touching CourseInfo: harden the existing unguarded
     `selectedCourse.achievementFormStatus` access (known crash risk)
6. **Tests.** Vitest + MSW: fetch-guard behavior (loads once, 404 → missing),
   `examsForCourse` matching (root join, exercise group, cross-listed, OT/AT
   order), ExamSchedule rendering for each state in step 5, and a
   reference-semester gating test. MSW handler for `/exams/HS26.json` serving a
   small fixture (not the full artifact).
7. **Docs.** ADR 0008 (runtime consumption: static fetch, fail-open, root-key
   join, borrowed-data gating), CHANGELOG entry.

## Verification

- `npm test` and `npm run lint` green.
- `npm run dev` → select an HS26 course with a central exam (e.g. 3,200
  Mikroökonomik II) → Course Details shows "Mon 18.01.2027, 09:15, 90 min";
  a decentral course shows the lecturer note; a language course with an oral
  shows the Compass note.
- Select a projected/future semester → no exam dates shown.
