import { selectorFamily } from "recoil";
import moment from "moment/moment";
import { examPlanState } from "./examScheduleAtom";
import {
  myCoursesSelector,
  semesterMetadataSelector,
} from "./unifiedCourseDataSelectors";
import {
  examClashes,
  formatExamDate,
  formatExamMeta,
  planExams,
} from "../helpers/examScheduleUtils";

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
 * The written exams of the user's courses for a semester (`planExams`), the
 * set every clash is checked against. Empty until the plan is ready, and for
 * a semester without one (fail open, ADR 0011).
 *
 * The pool is `myCoursesSelector` (enrolled ∪ selected), never the `filtered`
 * view state: a course must not stop warning because a search filter hides it.
 *
 * @returns {Array<{exam: Object, rootKey: string, name: string}>}
 */
export const plannedExamsSelector = selectorFamily({
  key: "plannedExamsSelector",
  get:
    (semesterShortName) =>
    ({ get }) => {
      const { status, plan } = get(examPlanSelector(semesterShortName));
      if (status !== "ready") return [];

      return planExams(plan, get(myCoursesSelector(semesterShortName)));
    },
});

/** Exam block border and text: hsg-900, 9.4:1 on the block's white fill. */
export const EXAM_COLOR = "#00521E";
/** danger — the red every exam-clash surface uses (ADR 0012); 4.8:1. */
export const EXAM_COLLISION_COLOR = "#DC2626";

/**
 * The user's central written exams as FullCalendar events.
 *
 * A sibling of `calendarEntriesSelector` rather than part of it: that selector
 * pins the lecture collision logic and the filter-leak invariant, and exams
 * neither participate in its Union-Find nor come from `calendarEntry` rows.
 * `Calendar.jsx` concatenates the two event sets. Same fail-open contract as
 * `plannedExamsSelector`: no plan, no exam blocks (ADR 0011).
 *
 * OT written exams only, one block per planned exam — orals publish no time,
 * and fabricating a block for one would be worse than showing none.
 *
 * Each event also carries how its block looks and the text its tooltip and
 * sheet show (`examDate`, `examMeta`), so neither surface rebuilds it.
 *
 * @returns {Array<Object>} FullCalendar events carrying `entryType: "exam"`
 */
export const examCalendarEventsSelector = selectorFamily({
  key: "examCalendarEventsSelector",
  get:
    (semesterShortName) =>
    ({ get }) => {
      const { status, plan } = get(examPlanSelector(semesterShortName));
      if (status !== "ready") return [];

      const plannedExams = get(plannedExamsSelector(semesterShortName));

      // Each block is red with its own exam's clashes. Several of my courses
      // can sit one exam (exercise groups, cross-listings); the first to
      // report clashes for it names them.
      const clashesById = new Map();
      for (const course of get(myCoursesSelector(semesterShortName))) {
        for (const [id, names] of examClashes(plannedExams, plan, course)) {
          if (!clashesById.has(id)) clashesById.set(id, names);
        }
      }

      return plannedExams.map(({ exam, name }) => {
        const conflictsWith = clashesById.get(exam.id) ?? [];
        const clashing = conflictsWith.length > 0;
        const accent = clashing ? EXAM_COLLISION_COLOR : EXAM_COLOR;
        return {
          id: exam.id,
          title: name,
          start: exam.startIso,
          // parseZone keeps the artifact's Zurich offset, so start and end
          // stay in one format.
          end: moment
            .parseZone(exam.startIso)
            .add(exam.durationMin, "minutes")
            .format(),
          entryType: "exam",
          examDate: formatExamDate(exam.date),
          examMeta: formatExamMeta(exam),
          conflictsWith,
          // Outlined rather than filled: a filled hsg-900 block sat 1.32:1 in
          // lightness from the enrolled-lecture green. A clash is dashed as
          // well as red — a phone cuts its words off, and red against green is
          // the pair colour-vision deficiencies confuse most. Border width and
          // style are classes because FullCalendar only takes colours per
          // event, important because its own stylesheet loads after ours;
          // `exam-block` carries the focus style in calendar.css.
          backgroundColor: "#FFFFFF",
          borderColor: accent,
          textColor: accent,
          classNames: [
            "exam-block",
            "!border-2",
            ...(clashing ? ["!border-dashed"] : []),
          ],
        };
      });
    },
});
