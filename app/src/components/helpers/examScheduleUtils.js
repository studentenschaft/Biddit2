/**
 * Pure lookup into an ingested exam plan (`public/exams/<SEMESTER>.json`,
 * ADR 0007/0008). No React, no I/O — the plan is passed in.
 */

import { getCourseRootKey } from "./courseUtils";

// The plan prints two-segment roots ("3,200"); app course numbers are
// "3,200,1.00". Joining on the root is also what makes an exercise group
// inherit its parent lecture's exam. The guard stays: the plan is
// runtime-fetched JSON, and this module is its fail-open boundary.
const matchesRoot = (entry, rootKey) =>
  Array.isArray(entry?.rootNumbers) && entry.rootNumbers.includes(rootKey);

/**
 * Finds the central exams for a course.
 *
 * @param {Object|null|undefined} plan - Parsed exam plan artifact
 * @param {Object|null|undefined} course - Course object
 * @returns {{ written: Array, oral: Array }} Always both keys, empty when unmatched
 */
export function examsForCourse(plan, course) {
  const rootKey = getCourseRootKey(course);
  if (!plan || !rootKey) return { written: [], oral: [] };

  return {
    // OT (regular date) before AT (alternative date); Array#sort is stable,
    // so entries keep the plan's date order within each group.
    written: (plan.written ?? [])
      .filter((entry) => matchesRoot(entry, rootKey))
      .sort((a, b) => (a.termType === "OT" ? 0 : 1) - (b.termType === "OT" ? 0 : 1)),
    oral: (plan.oral ?? []).filter((entry) => matchesRoot(entry, rootKey)),
  };
}

/**
 * Finds the central-exam collisions inside a set of courses.
 *
 * Two exams collide iff they share a date *and* a slot. Every written exam
 * starts 09:15 or 15:15 and none runs longer than 180', so no morning exam can
 * reach the afternoon slot and interval math would buy nothing — see ADR 0009.
 * Only OT (ordinary date) written exams count: AT rows are provisional and only
 * bind students granted the alternative date, and oral exams publish no time.
 *
 * @param {Object|null|undefined} plan - Parsed exam plan artifact
 * @param {Array|null|undefined} courses - The user's courses for the semester
 * @returns {Map<string, {exam: Object, conflictsWith: string[]}>} Keyed by
 *   two-segment root; `conflictsWith` names the other colliding roots.
 */
export function findExamCollisions(plan, courses) {
  const collisions = new Map();
  if (!Array.isArray(plan?.written) || !Array.isArray(courses)) {
    return collisions;
  }

  // A lecture and its exercise groups share one root and therefore one exam —
  // collapsing them here is what stops a course colliding with itself. The
  // first course seen names its root in the other courses' warnings.
  const nameByRoot = new Map();
  for (const course of courses) {
    const rootKey = getCourseRootKey(course);
    if (rootKey && !nameByRoot.has(rootKey)) {
      nameByRoot.set(rootKey, course?.shortName || rootKey);
    }
  }

  // (date, slot) → the roots of my courses sitting an exam in it.
  const bySlot = new Map();
  for (const exam of plan.written) {
    if (exam?.termType !== "OT" || !exam.date || !exam.slot) continue;
    const slotKey = `${exam.date} ${exam.slot}`;
    for (const rootKey of nameByRoot.keys()) {
      if (!matchesRoot(exam, rootKey)) continue;
      const group = bySlot.get(slotKey) ?? new Map();
      if (!group.has(rootKey)) group.set(rootKey, exam);
      bySlot.set(slotKey, group);
    }
  }

  for (const group of bySlot.values()) {
    if (group.size < 2) continue;
    for (const [rootKey, exam] of group) {
      // One warning per root: the first slot it clashes in wins.
      if (collisions.has(rootKey)) continue;
      collisions.set(rootKey, {
        exam,
        conflictsWith: [...group.keys()]
          .filter((other) => other !== rootKey)
          .map((other) => nameByRoot.get(other)),
      });
    }
  }

  return collisions;
}
