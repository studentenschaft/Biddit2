import { selectorFamily } from "recoil";
import { examSchedulesState } from "./examScheduleAtom";
import { myCoursesSelector } from "./unifiedCourseDataSelectors";
import { findExamCollisions } from "../helpers/examScheduleUtils";

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
