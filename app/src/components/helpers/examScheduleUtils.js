/**
 * Pure lookup into an ingested exam plan (`public/exams/<SEMESTER>.json`,
 * ADR 0010/0011). No React, no I/O — callers pass a ready plan. Nothing here
 * re-checks it: `examPlanState` checked the top-level shape when it loaded,
 * and every entry passed the ingestion CLI's validation, which refuses to
 * write a bad artifact.
 */

import { getCourseRootKey } from "./courseUtils";

// The plan prints two-segment roots ("3,200"); app course numbers are
// "3,200,1.00". Joining on the root is also what makes an exercise group
// inherit its parent lecture's exam.
const matchesRoot = (entry, rootKey) => entry.rootNumbers.includes(rootKey);

// Written exams are the OT (ordinary date) rows only: this PDF's AT rows are
// the previous term's alternative dates, and this term's AT plan is published
// separately.
const isOrdinary = (entry) => entry.termType === "OT";

/**
 * Finds the central exams for a course.
 *
 * @param {Object} plan - Parsed exam plan artifact
 * @param {Object|null|undefined} course - Course object
 * @returns {{ written: Array, oral: Array }} Always both keys, in plan order,
 *   empty when unmatched
 */
export function examsForCourse(plan, course) {
  const rootKey = getCourseRootKey(course);
  return {
    written: plan.written.filter(
      (entry) => isOrdinary(entry) && matchesRoot(entry, rootKey),
    ),
    oral: plan.oral.filter((entry) => matchesRoot(entry, rootKey)),
  };
}

/**
 * The written exams a set of courses sits, one entry per exam, in plan order.
 * A lecture and its exercise groups share a root, and a cross-listed exam
 * matches several roots, but either way it is one sitting; the first course
 * that sits it names it.
 *
 * @param {Object} plan - Parsed exam plan artifact
 * @param {Array} courses - Typically the user's courses for the semester
 * @returns {Array<{exam: Object, rootKey: string, name: string}>}
 */
export function planExams(plan, courses) {
  const planned = [];
  for (const exam of plan.written) {
    if (!isOrdinary(exam)) continue;
    const course = courses.find((c) => matchesRoot(exam, getCourseRootKey(c)));
    if (!course) continue;
    const rootKey = getCourseRootKey(course);
    planned.push({ exam, rootKey, name: course.shortName || rootKey });
  }
  return planned;
}

// [start, end) in epoch ms. `startIso` carries its Zurich offset, so the
// reader's timezone never enters.
const interval = (exam) => {
  const start = Date.parse(exam.startIso);
  return [start, start + exam.durationMin * 60000];
};

const overlaps = (a, b) => {
  const [aStart, aEnd] = interval(a);
  const [bStart, bEnd] = interval(b);
  return aStart < bEnd && bStart < aEnd;
};

/**
 * The planned exams each written exam of `course` clashes with (ADR 0012).
 *
 * A clash is a *different* exam, sat for a course of a *different* root, whose
 * time overlaps; exams that merely touch do not clash. Interval maths rather
 * than a (date, slot) match, so a plan with other start times stays correct.
 * `course` may be planned or only browsed.
 *
 * @param {Array} plannedExams - `planExams` of the user's courses
 * @param {Object} plan - Parsed exam plan artifact
 * @param {Object} course - Course object
 * @returns {Map<string, string[]>} Exam id → names of the planned exams it
 *   clashes with, deduped, in plan order; only clashing exams are keys
 */
export function examClashes(plannedExams, plan, course) {
  const rootKey = getCourseRootKey(course);
  const clashes = new Map();
  for (const exam of examsForCourse(plan, course).written) {
    const names = plannedExams
      .filter(
        (other) =>
          other.exam.id !== exam.id &&
          other.rootKey !== rootKey &&
          overlaps(exam, other.exam),
      )
      .map((other) => other.name);
    if (names.length > 0) clashes.set(exam.id, [...new Set(names)]);
  }
  return clashes;
}
