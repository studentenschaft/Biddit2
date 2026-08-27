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
