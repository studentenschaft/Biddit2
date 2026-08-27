import { selectorFamily } from "recoil";
import moment from "moment";
import { examSchedulesState } from "./examScheduleAtom";
import { myCoursesSelector } from "./unifiedCourseDataSelectors";
import { examsForCourse, findExamCollisions } from "../helpers/examScheduleUtils";
import { getCourseRootKey } from "../helpers/courseUtils";

/**
 * Central-exam collisions among the user's courses for a semester.
 *
 * Reads the atom only — `useExamSchedule` owns the fetching, so every surface
 * showing these warnings has to mount that hook once at container level, or the
 * atom stays empty and the map is silently empty with it (fail open, ADR 0008).
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
      const plan = get(examSchedulesState)[semesterShortName]?.plan;
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
 * `examCollisionsSelector`: this only reads the atom `useExamSchedule` fills,
 * so an unfetched or borrowed semester yields no exam blocks (ADR 0008).
 *
 * OT written exams only — orals publish no time and AT dates are provisional
 * (ADR 0009); fabricating a block for either would be worse than showing none.
 *
 * @returns {Array<Object>} FullCalendar events carrying `entryType: "exam"`
 */
export const examCalendarEventsSelector = selectorFamily({
  key: "examCalendarEventsSelector",
  get:
    (semesterShortName) =>
    ({ get }) => {
      const plan = get(examSchedulesState)[semesterShortName]?.plan;
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
          // Runtime-fetched JSON: an entry without a usable start or duration
          // has no block to draw.
          if (!exam.startIso || !(exam.durationMin > 0)) continue;
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
            // The plan only marks BYOD when the title spells it out, so this is
            // present-or-silent, never "not BYOD".
            byod: exam.byod === true,
            conflictsWith: overlapping ? collision.conflictsWith : [],
            color: overlapping ? EXAM_COLLISION_COLOR : EXAM_COLOR,
          });
        }
      }

      return [...byExamId.values()];
    },
});
