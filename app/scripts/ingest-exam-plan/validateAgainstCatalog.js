/**
 * Advisory two-way diff between the exam plan and a course-catalog snapshot.
 * It never fails the build: the catalog is a hand-exported snapshot and the PDF
 * abbreviates titles heavily, so the value is in the list of central courses
 * with no exam — that is how a dropped exam is spotted.
 * Pure: no fs, no clock, no process.
 */

import { getCourseRootKey } from "../../src/components/helpers/courseUtils.js";

export function validateAgainstCatalog(plan, catalog) {
  // DevTools exports arrive either bare or wrapped in `{ data: [...] }`.
  const courses = catalog.data ?? catalog;
  const catalogByRoot = new Map();
  const centralRoots = new Set();
  for (const course of courses) {
    // "3,200,1.00" and its exercise group "3,200,2.00" share the plan's
    // "3,200", by the same rule the app joins on.
    const root = getCourseRootKey(course);
    if (!catalogByRoot.has(root)) catalogByRoot.set(root, course);
    if (course.achievementFormStatus?.isCentral) centralRoots.add(root);
  }

  // Oral exams cover both the regular and the alternative date, so they count
  // as coverage regardless of term type.
  const examRoots = new Set(
    [...plan.written, ...plan.oral]
      .filter((exam) => exam.termType !== "AT")
      .flatMap((exam) => exam.rootNumbers),
  );

  return {
    centralCourseCount: centralRoots.size,
    centralCoursesWithoutExam: [...centralRoots]
      .filter((root) => !examRoots.has(root))
      .map((root) => ({ root, shortName: catalogByRoot.get(root).shortName })),
  };
}
