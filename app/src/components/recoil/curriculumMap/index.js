import { selector } from "recoil";
import { unifiedAcademicDataState } from "../unifiedAcademicDataAtom";
import { unifiedCourseDataState } from "../unifiedCourseDataAtom";
import { curriculumPlanState } from "../curriculumPlanAtom";
import { normalizeSemesterKey } from "../../../domain/semester";
import { findMainProgram } from "../../helpers/academicDataTransformers";
import { log } from "../../helpers/log";
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
} from "./categories.js";
import {
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
} from "./credits.js";
import {
  collectSemesterKeys,
  createGrid,
  placeCompletedCourses,
  placeWishlistCourses,
  placeEnrolledCourses,
  placePlannedItems,
} from "./placement.js";

export {
  findCreditsInAnySemester,
  getRequirementThreshold,
  formatCreditRange,
  getFillPercentage,
} from "./credits.js";
export {
  inferClassificationFromCourseName,
  resolveCategoryForCourse,
  resolveFallbackCategory,
  doesClassificationMatchCategory,
} from "./categories.js";

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

    const ctx = {
      flatCategories,
      unifiedCourseData,
      curriculumPlan,
      completedCourses,
    };
    const sortedSemesters = collectSemesterKeys(ctx);
    const coursesBySemesterAndCategory = createGrid(
      sortedSemesters,
      flatCategories,
    );

    placeCompletedCourses(ctx, coursesBySemesterAndCategory);
    placeWishlistCourses(ctx, coursesBySemesterAndCategory);
    placeEnrolledCourses(ctx, coursesBySemesterAndCategory);
    placePlannedItems(ctx, coursesBySemesterAndCategory);

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
