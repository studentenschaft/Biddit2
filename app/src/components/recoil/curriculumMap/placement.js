import {
  normalizeSemesterKey,
  sortSemesterKeys,
} from "../../../domain/semester";
import { toEcts } from "../../../domain/credits";
import { sameCourse } from "../../../domain/course";
import {
  resolveCategoryForCourse,
  resolveFallbackCategory,
} from "./categories.js";
import { findCreditsInAnySemester } from "./credits.js";

// Each place* pass is (ctx, grid) => void, with
// ctx = { flatCategories, unifiedCourseData, curriculumPlan, completedCourses }
// and grid[semesterKey][categoryPath] = course cards. Passes run in the order
// completed, wishlist, enrolled, planned; later passes read what earlier ones
// placed to avoid rendering a course twice.

/** Every semester that has transcript courses, plan items or a catalog, sorted. */
export const collectSemesterKeys = ({
  completedCourses,
  curriculumPlan,
  unifiedCourseData,
}) => {
  const allSemesterKeys = new Set();

  completedCourses.forEach((c) =>
    allSemesterKeys.add(normalizeSemesterKey(c.semester)),
  );
  Object.keys(curriculumPlan.plannedItems || {}).forEach((k) =>
    allSemesterKeys.add(normalizeSemesterKey(k)),
  );
  Object.keys(unifiedCourseData.semesters || {}).forEach((k) =>
    allSemesterKeys.add(normalizeSemesterKey(k)),
  );

  return sortSemesterKeys(Array.from(allSemesterKeys));
};

const addEmptySemester = (grid, semKey, flatCategories) => {
  grid[semKey] = {};
  flatCategories.forEach((cat) => {
    grid[semKey][cat.path] = [];
  });
};

export const createGrid = (semesterKeys, flatCategories) => {
  const grid = {};
  semesterKeys.forEach((semKey) =>
    addEmptySemester(grid, semKey, flatCategories),
  );
  return grid;
};

/**
 * The category a plan placement pins a course to, when that path is a real grid
 * row. Returns null when the course has no usable placement.
 *
 * @returns {string|null} A valid category path, or null
 */
const findPlacementCategoryPath = (plannedItems, courseId, flatCategories) => {
  const placement = (plannedItems || []).find(
    (item) => item.type === "course" && item.courseId === courseId,
  );
  if (!placement?.categoryPath) return null;

  return flatCategories.some((cat) => cat.path === placement.categoryPath)
    ? placement.categoryPath
    : null;
};

/** Course ids the enrolled pass rendered in a semester. */
const enrolledCourseIds = (grid, semKey) =>
  new Set(
    Object.values(grid[semKey] || {})
      .flat()
      .filter((course) => course.source === "enrolled")
      .map((course) => course.courseId),
  );

export const placeCompletedCourses = (ctx, grid) => {
  const { flatCategories, completedCourses } = ctx;

  completedCourses.forEach((course) => {
    const semKey = normalizeSemesterKey(course.semester);
    const catPath = course.categoryPath;

    if (grid[semKey]) {
      const matchedCat = flatCategories.find(
        (c) => c.path === catPath || catPath.startsWith(c.path),
      );

      if (matchedCat) {
        grid[semKey][matchedCat.path].push({
          ...course,
          semester: semKey,
          source: "transcript",
        });
      }
    }
  });
};

/**
 * The wishlist is each semester's selectedIds, resolved against its
 * catalog with myCoursesSelector's rule. An id that matches no course (or
 * a catalog not loaded yet) renders nothing, so the map agrees with the
 * Summary. Enrolled courses and courses with a plan placement are rendered
 * by their own passes, so they are skipped here to avoid a second card.
 */
export const placeWishlistCourses = (ctx, grid) => {
  const { flatCategories, unifiedCourseData, curriculumPlan } = ctx;

  const placedCourseIds = new Set(
    Object.values(curriculumPlan.plannedItems || {})
      .flat()
      .filter((item) => item.type === "course")
      .map((item) => item.courseId),
  );

  Object.entries(unifiedCourseData.semesters || {}).forEach(
    ([rawSemKey, semData]) => {
      const semKey = normalizeSemesterKey(rawSemKey);
      if (!grid[semKey]) return;

      // Per-plan wishlist overrides: skip courses hidden in the active plan
      const removedIds =
        curriculumPlan.wishlistOverrides?.[semKey]?.removedCourseIds || [];
      const enrolledIds = semData.enrolledIds || [];
      const availableCourses = semData.available || [];

      (semData.selectedIds || []).forEach((courseId) => {
        const fullCourse = availableCourses.find((c) =>
          sameCourse(c, { id: courseId }),
        );
        if (!fullCourse) return;
        // Overrides and placements written before ids were unified may
        // carry the catalog event id instead of the course number.
        const ids = [courseId, fullCourse.id].filter(Boolean);
        if (
          enrolledIds.includes(courseId) ||
          ids.some((id) => removedIds.includes(id) || placedCourseIds.has(id))
        ) {
          return;
        }

        const classification = fullCourse.classification || "elective";
        const matchedCat = resolveCategoryForCourse({
          classification,
          courseName: fullCourse.shortName || fullCourse.description,
          flatCategories,
        });
        const targetCatPath =
          matchedCat?.path || resolveFallbackCategory(flatCategories)?.path;

        if (import.meta.env.DEV && !matchedCat) {
          console.warn(
            `[CurriculumMap] No category match for course "${fullCourse.shortName || courseId}"`,
            `\n  Classification: "${classification}"`,
            `\n  Available categories:`,
            flatCategories.map(
              (c) => `${c.name} [${c.validClassifications.join(", ")}]`,
            ),
          );
        }

        if (targetCatPath && grid[semKey][targetCatPath]) {
          grid[semKey][targetCatPath].push({
            id: courseId,
            courseId,
            name: fullCourse.shortName || courseId,
            credits: toEcts(
              fullCourse.credits ??
                findCreditsInAnySemester(courseId, unifiedCourseData.semesters),
            ),
            semester: semKey,
            categoryPath: targetCatPath,
            status: "planned",
            isCompleted: false,
            isPlanned: true,
            classification,
            source: "wishlist",
            calendarEntry: fullCourse.calendarEntry,
          });
        }
      });
    },
  );
};

/**
 * A plan placement for an enrolled course overrides its inferred category.
 */
export const placeEnrolledCourses = (ctx, grid) => {
  const { flatCategories, unifiedCourseData, curriculumPlan } = ctx;

  Object.entries(unifiedCourseData.semesters || {}).forEach(
    ([semKey, semData]) => {
      const normalizedSemKey = normalizeSemesterKey(semKey);
      if (!grid[normalizedSemKey]) return;

      const enrolledIds = semData.enrolledIds || [];
      const availableCourses = semData.available || [];

      enrolledIds.forEach((enrolledId) => {
        const alreadyExists = Object.values(grid[normalizedSemKey])
          .flat()
          .some((c) => c.id === enrolledId || c.courseId === enrolledId);

        if (alreadyExists) return;

        const fullCourse = availableCourses.find((c) =>
          sameCourse(c, { id: enrolledId }),
        );

        if (!fullCourse) return;

        const classification =
          fullCourse.classification || fullCourse.big_type || "elective";

        // A plan placement for the same course is the student's own
        // correction and outranks any inferred category.
        const overridePath = findPlacementCategoryPath(
          curriculumPlan.plannedItems?.[normalizedSemKey],
          enrolledId,
          flatCategories,
        );

        const matchedCat =
          overridePath === null
            ? resolveCategoryForCourse({
                classification,
                courseName: fullCourse.shortName || fullCourse.description,
                flatCategories,
              })
            : null;
        const targetCatPath =
          overridePath ??
          matchedCat?.path ??
          resolveFallbackCategory(flatCategories)?.path;

        if (import.meta.env.DEV && !matchedCat && overridePath === null) {
          console.warn(
            `[CurriculumMap] No category match for enrolled course "${fullCourse.shortName || enrolledId}"`,
            `\n  Classification: "${classification}"`,
            `\n  Available categories:`,
            flatCategories.map(
              (c) => `${c.name} [${c.validClassifications.join(", ")}]`,
            ),
          );
        }

        if (targetCatPath && grid[normalizedSemKey][targetCatPath]) {
          grid[normalizedSemKey][targetCatPath].push({
            id: enrolledId,
            courseId: enrolledId,
            name: fullCourse.shortName || fullCourse.description || enrolledId,
            credits: toEcts(
              fullCourse.credits ??
                findCreditsInAnySemester(
                  enrolledId,
                  unifiedCourseData.semesters,
                ),
            ),
            semester: normalizedSemKey,
            categoryPath: targetCatPath,
            status: "enrolled",
            isCompleted: false,
            isEnrolled: true,
            classification,
            source: "enrolled",
            calendarEntry: fullCourse.calendarEntry,
          });
        }
      });
    },
  );
};

/**
 * Plan items: placeholders and planned courses. Enrolled courses already
 * rendered from their placement are skipped.
 */
export const placePlannedItems = (ctx, grid) => {
  const { flatCategories, unifiedCourseData, curriculumPlan } = ctx;

  Object.entries(curriculumPlan.plannedItems || {}).forEach(
    ([semKey, items]) => {
      const enrolledIds = enrolledCourseIds(grid, normalizeSemesterKey(semKey));
      if (!grid[semKey]) addEmptySemester(grid, semKey, flatCategories);

      items.forEach((item) => {
        // The enrolled pass already rendered this course (using this very
        // placement as its category override) — don't duplicate the card.
        if (item.type === "course" && enrolledIds.has(item.courseId)) {
          return;
        }

        // First try the stored categoryPath
        let targetCatPath = item.categoryPath;

        // Check if categoryPath is a valid path in flatCategories
        if (
          targetCatPath &&
          !flatCategories.some((cat) => cat.path === targetCatPath)
        ) {
          // Try to find a category by matching the categoryPath as a name or partial path
          const matchedByName = flatCategories.find(
            (cat) =>
              cat.name === targetCatPath ||
              cat.path.endsWith(`/${targetCatPath}`) ||
              cat.path.includes(targetCatPath),
          );
          if (matchedByName) {
            targetCatPath = matchedByName.path;
          } else {
            // Fall back to classification matching for courses
            if (item.type === "course") {
              const availableCourses =
                unifiedCourseData.semesters?.[semKey]?.available || [];
              const fullCourse = availableCourses.find((c) =>
                sameCourse(c, { id: item.courseId }),
              );
              const classification =
                fullCourse?.classification || item.categoryPath || "elective";
              const matchedCat = resolveCategoryForCourse({
                classification,
                courseName:
                  item.shortName ||
                  fullCourse?.shortName ||
                  fullCourse?.description,
                flatCategories,
              });
              targetCatPath =
                matchedCat?.path ||
                resolveFallbackCategory(flatCategories)?.path ||
                "";
            } else {
              targetCatPath =
                resolveFallbackCategory(flatCategories)?.path || "";
            }
          }
        }

        // Fall back to the least-wrong bucket if still no match
        if (!targetCatPath) {
          targetCatPath = resolveFallbackCategory(flatCategories)?.path || "";
        }

        if (grid[semKey][targetCatPath]) {
          if (item.type === "placeholder") {
            grid[semKey][targetCatPath].push({
              id: item.id,
              name: item.label || "TBD",
              label: item.label || "TBD",
              credits: item.credits,
              semester: semKey,
              categoryPath: targetCatPath,
              status: "placeholder",
              isPlaceholder: true,
              source: "plan",
              note: item.note,
              colorCode: item.colorCode,
            });
          } else if (item.type === "course") {
            const availableCourses =
              unifiedCourseData.semesters?.[semKey]?.available || [];
            const fullCourse = availableCourses.find((c) =>
              sameCourse(c, { id: item.courseId }),
            );

            grid[semKey][targetCatPath].push({
              id: item.courseId,
              courseId: item.courseId,
              name: fullCourse?.shortName || item.shortName || item.courseId,
              shortName: item.shortName || fullCourse?.shortName,
              credits: toEcts(
                item.credits ??
                  fullCourse?.credits ??
                  findCreditsInAnySemester(
                    item.courseId,
                    unifiedCourseData.semesters,
                  ),
              ),
              semester: semKey,
              categoryPath: targetCatPath,
              status: "planned",
              isCompleted: false,
              isPlanned: true,
              source: "plan",
              calendarEntry: fullCourse?.calendarEntry,
              note: item.note,
              colorCode: item.colorCode,
            });
          }
        }
      });
    },
  );
};
