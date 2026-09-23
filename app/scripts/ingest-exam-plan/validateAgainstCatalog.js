/**
 * Advisory two-way diff between the exam plan and a course-catalog snapshot.
 * It never fails the build: the catalog is a hand-exported snapshot and the PDF
 * abbreviates titles heavily, so the value is in the list of central courses
 * with no exam — that is how a dropped exam is spotted.
 * Pure: no fs, no clock, no process.
 */

const ROOT_SEGMENTS = 2;

/**
 * "3,200,1.00" (course) and "3,200,2.00" (its exercise group) share the root
 * "3,200" that the exam plan prints — the rule `getCourseRootKey` applies at
 * runtime.
 */
const courseNumberToRoot = (courseNumber) =>
  courseNumber.split(",").slice(0, ROOT_SEGMENTS).join(",");

export function validateAgainstCatalog(plan, catalog) {
  // DevTools exports arrive either bare or wrapped in `{ data: [...] }`.
  const courses = catalog.data ?? catalog;
  const catalogByRoot = new Map();
  const centralRoots = new Set();
  for (const course of courses) {
    const root = courseNumberToRoot(course.courseNumber);
    if (!catalogByRoot.has(root)) catalogByRoot.set(root, course);
    if (course.achievementFormStatus?.isCentral) centralRoots.add(root);
  }

  // Oral exams cover both the regular and the alternative date, so they count
  // as coverage regardless of term type.
  const examRoots = new Map();
  for (const exam of [...plan.written, ...plan.oral]) {
    if (exam.termType === "AT") continue;
    for (const root of exam.rootNumbers) {
      if (!examRoots.has(root)) examRoots.set(root, exam);
    }
  }

  const centralCoursesWithoutExam = [...centralRoots]
    .filter((root) => !examRoots.has(root))
    .map((root) => ({ root, shortName: catalogByRoot.get(root).shortName }));

  const examsWithoutCourse = [...examRoots.entries()]
    .filter(([root]) => !catalogByRoot.has(root))
    .map(([root, exam]) => ({ root, title: exam.title }));

  return {
    centralCourseCount: centralRoots.size,
    centralCoursesWithoutExam,
    examsWithoutCourse,
  };
}
