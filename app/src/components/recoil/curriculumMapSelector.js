import { selector } from "recoil";
import { unifiedAcademicDataState } from "./unifiedAcademicDataAtom";
import { unifiedCourseDataState } from "./unifiedCourseDataAtom";
import { curriculumPlanState } from "./curriculumPlanAtom";
import { normalizeSemesterKey, sortSemesterKeys } from "../../domain/semester";
import { findMainProgram } from "../helpers/academicDataTransformers";
import { log } from "../helpers/log";
import { toEcts } from "../../domain/credits";
import { sameCourse } from "../../domain/course";
import {
  extractClassifications,
  extractCategoryHierarchy,
  extractCoursesFromHierarchy,
  getHierarchyDepth,
  flattenCategoriesForGrid,
  matchClassificationToCategory,
  inferClassificationFromCourseName,
  resolveCategoryForCourse,
  resolveFallbackCategory,
} from "./curriculumMap/categories.js";
import {
  findCreditsInAnySemester,
  meetsRequirement,
  fallsShort,
  summarizeLeafCredits,
  buildCategoryHierarchy,
  computeSemesterCreditStats,
  estimateCompletion,
  normalizeExerciseGroupCredits,
  computeSemesterStats,
  computeCategoryCredits,
  computeProgramStats,
} from "./curriculumMap/credits.js";

export {
  findCreditsInAnySemester,
  getRequirementThreshold,
  formatCreditRange,
  getFillPercentage,
} from "./curriculumMap/credits.js";
export {
  inferClassificationFromCourseName,
  resolveCategoryForCourse,
  resolveFallbackCategory,
  doesClassificationMatchCategory,
} from "./curriculumMap/categories.js";

// ────────────────────────────────────────────────────────────────────────────
// Pure helper functions
// ────────────────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────────────────
// Empty state template
// ────────────────────────────────────────────────────────────────────────────

const createEmptyResult = (isLoaded, validations) => ({
  isLoaded,
  program: null,
  categories: [],
  flatCategories: [],
  categoryHierarchy: [],
  semesters: [],
  coursesBySemesterAndCategory: {},
  validations,
});

// ────────────────────────────────────────────────────────────────────────────
// Selector 1: Category structure (depends only on academic data)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extracts the structural category data from the transcript scorecard.
 * This only depends on unifiedAcademicDataState, so it won't recompute
 * when courses are moved around in the grid.
 */
export const curriculumCategoryStructureSelector = selector({
  key: "curriculumCategoryStructureSelector",
  get: ({ get }) => {
    const academicData = get(unifiedAcademicDataState);

    if (!academicData.initialization?.isInitialized || !academicData.programs) {
      return {
        isReady: false,
        mainProgramId: null,
        rawScorecard: null,
        categories: [],
        flatCategories: [],
        completedCourses: [],
      };
    }

    const mainProgramId = findMainProgram(
      Object.fromEntries(
        Object.entries(academicData.programs).map(([id, p]) => [
          id,
          { isMainStudy: p.metadata?.isMainStudy },
        ]),
      ),
    );

    if (!mainProgramId) {
      return {
        isReady: false,
        mainProgramId: null,
        rawScorecard: null,
        categories: [],
        flatCategories: [],
        completedCourses: [],
      };
    }

    const mainProgram = academicData.programs[mainProgramId];
    const rawScorecard = mainProgram?.transcript?.rawScorecard;

    const categories = rawScorecard?.items
      ? extractCategoryHierarchy(rawScorecard.items)
      : [];

    if (import.meta.env.DEV && categories.length > 0) {
      const shouldSkipLevel0 =
        categories.length === 1 && categories[0].children.length > 0;
      const effectiveParents = shouldSkipLevel0
        ? categories[0].children
        : categories;
      const totalDepth = getHierarchyDepth(categories);
      log.debug("[CurriculumMap] Category hierarchy structure:", {
        totalDepth,
        skippingProgramWrapper: shouldSkipLevel0,
        programName: shouldSkipLevel0 ? categories[0].name : "(none)",
        effectiveGroupingParents: effectiveParents.map((c) => ({
          name: c.name,
          level: c.level,
          hasChildren: c.children.length > 0,
          childCount: c.children.length,
          children: c.children.map((ch) => ch.name),
        })),
      });
    }

    const flatCategories = flattenCategoriesForGrid(categories);

    const completedCourses = rawScorecard?.items
      ? extractCoursesFromHierarchy(rawScorecard.items)
      : [];

    return {
      isReady: true,
      mainProgramId,
      rawScorecard,
      categories,
      flatCategories,
      completedCourses,
    };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Selector 2: Course grid assembly + stats (depends on all data sources)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Main curriculum map selector.
 * Combines category structure with course data from multiple sources
 * into a grid-ready structure for rendering.
 */
export const curriculumMapSelector = selector({
  key: "curriculumMapSelector",
  get: ({ get }) => {
    const categoryStructure = get(curriculumCategoryStructureSelector);
    const unifiedCourseData = get(unifiedCourseDataState);
    const curriculumPlan = get(curriculumPlanState);

    if (!categoryStructure.isReady) {
      return createEmptyResult(
        categoryStructure.mainProgramId !== null,
        curriculumPlan.validations,
      );
    }

    const {
      mainProgramId,
      rawScorecard,
      categories,
      flatCategories,
      completedCourses,
    } = categoryStructure;

    // ── Collect all semester keys ──────────────────────────────────────────
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

    const sortedSemesters = sortSemesterKeys(Array.from(allSemesterKeys));

    // ── Initialize grid ───────────────────────────────────────────────────
    const coursesBySemesterAndCategory = {};

    sortedSemesters.forEach((semKey) => {
      coursesBySemesterAndCategory[semKey] = {};
      flatCategories.forEach((cat) => {
        coursesBySemesterAndCategory[semKey][cat.path] = [];
      });
    });

    // ── Place completed courses ───────────────────────────────────────────
    completedCourses.forEach((course) => {
      const semKey = normalizeSemesterKey(course.semester);
      const catPath = course.categoryPath;

      if (coursesBySemesterAndCategory[semKey]) {
        const matchedCat = flatCategories.find(
          (c) => c.path === catPath || catPath.startsWith(c.path),
        );

        if (matchedCat) {
          coursesBySemesterAndCategory[semKey][matchedCat.path].push({
            ...course,
            semester: semKey,
            source: "transcript",
          });
        }
      }
    });

    // ── Place wishlist courses ────────────────────────────────────────────
    // The wishlist is each semester's selectedIds, resolved against its
    // catalog with myCoursesSelector's rule. An id that matches no course (or
    // a catalog not loaded yet) renders nothing, so the map agrees with the
    // Summary. Enrolled courses and courses with a plan placement are rendered
    // by their own passes, so they are skipped here to avoid a second card.
    const placedCourseIds = new Set(
      Object.values(curriculumPlan.plannedItems || {})
        .flat()
        .filter((item) => item.type === "course")
        .map((item) => item.courseId),
    );

    Object.entries(unifiedCourseData.semesters || {}).forEach(
      ([rawSemKey, semData]) => {
        const semKey = normalizeSemesterKey(rawSemKey);
        if (!coursesBySemesterAndCategory[semKey]) return;

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

          if (
            targetCatPath &&
            coursesBySemesterAndCategory[semKey][targetCatPath]
          ) {
            coursesBySemesterAndCategory[semKey][targetCatPath].push({
              id: courseId,
              courseId,
              name: fullCourse.shortName || courseId,
              credits: toEcts(
                fullCourse.credits ??
                  findCreditsInAnySemester(
                    courseId,
                    unifiedCourseData.semesters,
                  ),
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

    // ── Place enrolled courses ────────────────────────────────────────────
    // Courses rendered as enrolled cards, so the plan pass does not duplicate
    // them from their (override) placement.
    const enrolledCourseIdsBySemester = {};

    Object.entries(unifiedCourseData.semesters || {}).forEach(
      ([semKey, semData]) => {
        const normalizedSemKey = normalizeSemesterKey(semKey);
        if (!coursesBySemesterAndCategory[normalizedSemKey]) return;

        const enrolledIds = semData.enrolledIds || [];
        const availableCourses = semData.available || [];

        enrolledIds.forEach((enrolledId) => {
          const alreadyExists = Object.values(
            coursesBySemesterAndCategory[normalizedSemKey],
          )
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

          enrolledCourseIdsBySemester[normalizedSemKey] ??= new Set();
          enrolledCourseIdsBySemester[normalizedSemKey].add(enrolledId);

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

          if (
            targetCatPath &&
            coursesBySemesterAndCategory[normalizedSemKey][targetCatPath]
          ) {
            coursesBySemesterAndCategory[normalizedSemKey][targetCatPath].push({
              id: enrolledId,
              courseId: enrolledId,
              name:
                fullCourse.shortName || fullCourse.description || enrolledId,
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

    // ── Place curriculum plan items ───────────────────────────────────────
    Object.entries(curriculumPlan.plannedItems || {}).forEach(
      ([semKey, items]) => {
        if (!coursesBySemesterAndCategory[semKey]) {
          coursesBySemesterAndCategory[semKey] = {};
          flatCategories.forEach((cat) => {
            coursesBySemesterAndCategory[semKey][cat.path] = [];
          });
        }

        items.forEach((item) => {
          // The enrolled pass already rendered this course (using this very
          // placement as its category override) — don't duplicate the card.
          if (
            item.type === "course" &&
            enrolledCourseIdsBySemester[normalizeSemesterKey(semKey)]?.has(
              item.courseId,
            )
          ) {
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

          if (coursesBySemesterAndCategory[semKey][targetCatPath]) {
            if (item.type === "placeholder") {
              coursesBySemesterAndCategory[semKey][targetCatPath].push({
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

              coursesBySemesterAndCategory[semKey][targetCatPath].push({
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

    normalizeExerciseGroupCredits(
      coursesBySemesterAndCategory,
      sortedSemesters,
    );

    const semesters = computeSemesterStats(
      coursesBySemesterAndCategory,
      sortedSemesters,
      curriculumPlan.semesterNotes,
    );
    const categoriesWithCredits = computeCategoryCredits(
      flatCategories,
      coursesBySemesterAndCategory,
      sortedSemesters,
    );

    // ── Build hierarchy for nested headers ────────────────────────────────
    const categoryHierarchy = buildCategoryHierarchy(
      categories,
      categoriesWithCredits,
    );

    if (import.meta.env.DEV && categoryHierarchy.length > 0) {
      const hasNestedHeaders = categoryHierarchy.some(
        (p) => p.children.length > 1,
      );
      log.debug("[CurriculumMap] Hierarchy result:", {
        hasNestedHeaders,
        parents: categoryHierarchy.map((p) => ({
          name: p.name,
          colspan: p.colspan,
          isLeaf: p.isLeaf,
          childCount: p.children.length,
          children: p.children.map((c) => c.name),
        })),
      });
    }

    return {
      isLoaded: true,
      program: computeProgramStats({
        mainProgramId,
        rawScorecard,
        categoriesWithCredits,
        semesters,
      }),
      categories,
      flatCategories: categoriesWithCredits,
      categoryHierarchy,
      semesters,
      coursesBySemesterAndCategory,
      validations: curriculumPlan.validations,
    };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Derived convenience selectors
// ────────────────────────────────────────────────────────────────────────────

/** Flat category list (useful for CoursePicker) */
export const curriculumCategoriesSelector = selector({
  key: "curriculumCategoriesSelector",
  get: ({ get }) => {
    const mapData = get(curriculumMapSelector);
    return mapData.flatCategories;
  },
});

/** Semester list with stats */
export const curriculumSemestersSelector = selector({
  key: "curriculumSemestersSelector",
  get: ({ get }) => {
    const mapData = get(curriculumMapSelector);
    return mapData.semesters;
  },
});

/** Program overview stats */
export const curriculumProgramSelector = selector({
  key: "curriculumProgramSelector",
  get: ({ get }) => {
    const mapData = get(curriculumMapSelector);
    return mapData.program;
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Exported for testing
// ────────────────────────────────────────────────────────────────────────────

export const _testHelpers = {
  normalizeSemesterKey,
  extractClassifications,
  extractCategoryHierarchy,
  extractCoursesFromHierarchy,
  flattenCategoriesForGrid,
  buildCategoryHierarchy,
  meetsRequirement,
  fallsShort,
  summarizeLeafCredits,
  matchClassificationToCategory,
  resolveFallbackCategory,
  inferClassificationFromCourseName,
  resolveCategoryForCourse,
  estimateCompletion,
  computeSemesterCreditStats,
};
