import { selectorFamily } from "recoil";
import moment from "moment";
import { examPlanState } from "./examScheduleAtom";
import {
  myCoursesSelector,
  semesterMetadataSelector,
} from "./unifiedCourseDataSelectors";
import { examsForCourse, findExamCollisions } from "../helpers/examScheduleUtils";
import { getCourseRootKey } from "../helpers/courseUtils";

const NO_PLAN = { status: "none", plan: null };

/**
 * The exam plan to show for a semester, as `{ status, plan }`, and the one
 * borrowed-data gate: a borrowed catalog lists courses that are not running
 * this term, so their exam dates would be someone else's. Checked before the
 * atom is read, so such a semester is never fetched, and re-checked whenever
 * `usingReferenceData` flips (ADR 0011).
 */
export const examPlanSelector = selectorFamily({
  key: "examPlanSelector",
  get:
    (semesterShortName) =>
    ({ get }) => {
      if (!semesterShortName) return NO_PLAN;
      const metadata = get(semesterMetadataSelector(semesterShortName));
      if (metadata.isFutureSemester || metadata.usingReferenceData) {
        return NO_PLAN;
      }
      return get(examPlanState(semesterShortName));
    },
});

/**
 * Central-exam collisions among the user's courses for a semester. Empty
 * until the plan has loaded, and for a semester without one (fail open,
 * ADR 0011).
 *
 * The pool is `myCoursesSelector` (enrolled ∪ selected), never the `filtered`
 * view state: a course must not stop warning because a search filter hides it.
 *
 * @returns {Map<string, {exam: Object, conflictsWith: string[]}>} Keyed by
 *   two-segment course root; empty when nothing collides.
 */
export const examCollisionsSelector = selectorFamily({
  key: "examCollisionsSelector",
  get:
    (semesterShortName) =>
    ({ get }) => {
      const { plan } = get(examPlanSelector(semesterShortName));
      if (!plan) return new Map();

      return findExamCollisions(plan, get(myCoursesSelector(semesterShortName)));
    },
});

/** Exam block base color: hsg-900, dark enough to read as "not a lecture". */
export const EXAM_COLOR = "#00521E";
/** danger — same red the Phase 2 surfaces use for an exam clash. */
export const EXAM_COLLISION_COLOR = "#DC2626";

/**
 * The user's central written exams as FullCalendar events.
 *
 * A sibling of `calendarEntriesSelector` rather than part of it: that selector
 * pins the lecture collision logic and the filter-leak invariant, and exams
 * neither participate in its Union-Find nor come from `calendarEntry` rows.
 * `Calendar.jsx` concatenates the two event sets. Same fail-open contract as
 * `examCollisionsSelector`: no plan, no exam blocks (ADR 0011).
 *
 * OT written exams only — orals publish no time and AT dates are provisional
 * (ADR 0012); fabricating a block for either would be worse than showing none.
 *
 * @returns {Array<Object>} FullCalendar events carrying `entryType: "exam"`
 */
export const examCalendarEventsSelector = selectorFamily({
  key: "examCalendarEventsSelector",
  get:
    (semesterShortName) =>
    ({ get }) => {
      const { plan } = get(examPlanSelector(semesterShortName));
      if (!plan) return [];

      const courses = get(myCoursesSelector(semesterShortName));
      const collisions = get(examCollisionsSelector(semesterShortName));

      // Keyed by exam id, so one exam is one block however many of my courses
      // sit it: a lecture and its exercise groups share a root and therefore
      // the same exam entry, and a cross-listed exam matches several roots.
      const byExamId = new Map();

      for (const course of courses) {
        const rootKey = getCourseRootKey(course);
        if (!rootKey) continue;
        const collision = collisions.get(rootKey);

        for (const exam of examsForCourse(plan, course).written) {
          if (exam.termType !== "OT") continue;
          if (byExamId.has(exam.id)) continue;

          const overlapping = collision?.exam?.id === exam.id;
          byExamId.set(exam.id, {
            id: exam.id,
            title: course.shortName || rootKey,
            start: exam.startIso,
            // parseZone keeps the artifact's Zurich offset, so start and end
            // stay in one format.
            end: moment
              .parseZone(exam.startIso)
              .add(exam.durationMin, "minutes")
              .format(),
            entryType: "exam",
            durationMin: exam.durationMin,
            // Present-or-silent: shows the plan's BYOD marking, never "not
            // BYOD".
            byod: exam.byod === true,
            conflictsWith: overlapping ? collision.conflictsWith : [],
            color: overlapping ? EXAM_COLLISION_COLOR : EXAM_COLOR,
          });
        }
      }

      return [...byExamId.values()];
    },
});
