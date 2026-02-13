import { selector } from "recoil";
import { unifiedAcademicDataState } from "./unifiedAcademicDataAtom";
import { unifiedCourseDataState } from "./unifiedCourseDataAtom";
import { localSelectedCoursesSemKeyState } from "./localSelectedCoursesSemKeyAtom";
import {
  curriculumPlanState,
  sortSemesters,
  parseSemesterKey,
  getSemesterStatus,
} from "./curriculumPlanAtom";
import { findMainProgram } from "../helpers/academicDataTransformers";
import { processExerciseGroupECTS } from "../helpers/smartExerciseGroupHandler";

// ────────────────────────────────────────────────────────────────────────────
// Pure helper functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Normalize semester key by removing spaces (e.g., "FS 25" -> "FS25")
 * Handles inconsistency between scorecard API (with spaces) and internal state (without)
 */
const normalizeSemesterKey = (semester) => {
  return semester ? semester.replace(/\s+/g, "") : "";
};

/**
 * Extract classification values that should map to a category.
 * Uses category name/description patterns to infer valid classifications.
 */
const extractClassifications = (categoryItem) => {
  const classifications = [];
  const name = (categoryItem.description || categoryItem.shortName || "").toLowerCase();

  const patterns = [
    { keywords: ["compulsory", "pflicht", "mandatory"], values: ["compulsory", "pflicht", "Pflichtbereich", "mandatory", "Pflicht"] },
    { keywords: ["context", "kontext"], values: ["context", "kontext", "Contextual Studies", "Kontextstudium"] },
    { keywords: ["focus", "schwerpunkt", "major", "concentration"], values: ["focus", "schwerpunkt", "Focus Area", "Major", "Concentration", "Schwerpunktfächer"] },
    { keywords: ["method", "forschung", "research"], values: ["method", "forschung", "Research Methods", "Forschungsmethoden"] },
    { keywords: ["thesis", "arbeit", "dissertation"], values: ["thesis", "masterarbeit", "bachelorarbeit", "Thesis", "Master Thesis", "Bachelor Thesis"] },
    { keywords: ["project", "projekt"], values: ["project", "projekt", "Projects", "Projekte"] },
    { keywords: ["core", "kern", "foundation"], values: ["core", "kern", "Core", "Foundation", "Kernbereich"] },
    { keywords: ["seminar"], values: ["seminar", "Seminar", "Seminare"] },
    { keywords: ["integration", "capstone"], values: ["integration", "capstone", "Integrationsfächer", "Capstone"] },
  ];

  for (const { keywords, values } of patterns) {
    if (keywords.some((kw) => name.includes(kw))) {
      classifications.push(...values);
    }
  }

  // "elective"/"wahl" must exclude "pflicht" to avoid matching "Wahlpflicht"
  if ((name.includes("elective") || name.includes("wahl")) && !name.includes("pflicht")) {
    classifications.push("elective", "wahl", "Wahlbereich", "Elective", "Wahl");
  }

  return classifications;
};

/**
 * Recursively extract category structure from scorecard items
 */
const extractCategoryHierarchy = (items, parentPath = "", level = 0) => {
  const categories = [];

  (items || []).forEach((item) => {
    if (item.isTitle) {
      const name = item.description || item.shortName || "Unknown";
      const path = parentPath ? `${parentPath}/${name}` : name;

      const category = {
        id: item.hierarchy || path,
        path,
        name,
        level,
        minCredits: parseFloat(item.minCredits) || 0,
        maxCredits: parseFloat(item.maxCredits) || 0,
        earnedCredits: parseFloat(item.sumOfCredits) || 0,
        validClassifications: extractClassifications(item),
        plannedCredits: 0,
        children: [],
      };

      if (item.items && Array.isArray(item.items)) {
        category.children = extractCategoryHierarchy(item.items, path, level + 1);
      }

      categories.push(category);
    }
  });

  return categories;
};

/**
 * Extract courses (non-title items) with their semester and category info
 */
const extractCoursesFromHierarchy = (items, categoryPath = "", parentHierarchy = "") => {
  const courses = [];

  (items || []).forEach((item) => {
    if (item.isTitle) {
      const subPath = categoryPath
        ? `${categoryPath}/${item.description || item.shortName}`
        : item.description || item.shortName;

      if (item.items) {
        courses.push(
          ...extractCoursesFromHierarchy(item.items, subPath, item.hierarchy)
        );
      }
    } else if (!item.isTitle && item.semester) {
      courses.push({
        id: item.hierarchy || item.shortName || item.description,
        courseId: item.courseNumber || item.id || item.hierarchy,
        name: item.description || item.shortName,
        credits: parseFloat(item.sumOfCredits) || 0,
        semester: item.semester,
        categoryPath,
        categoryHierarchy: parentHierarchy,
        grade: item.mark || item.gradeText,
        gradeText: item.gradeText,
        status: item.gradeText ? "completed" : "enrolled",
        isCompleted: !!item.gradeText,
        classification: item.classification,
      });
    }
  });

  return courses;
};

/**
 * Calculate the maximum depth of a category hierarchy
 */
const getHierarchyDepth = (categories, currentDepth = 0) => {
  if (!categories?.length) return currentDepth;

  let maxDepth = currentDepth;
  categories.forEach((cat) => {
    if (cat.children?.length > 0) {
      const childDepth = getHierarchyDepth(cat.children, currentDepth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    }
  });

  return maxDepth;
};

/**
 * Flatten categories to leaf nodes for grid columns.
 * Skips single program-wrapper roots. Tracks grouping parent for header display.
 */
const flattenCategoriesForGrid = (categories) => {
  const flattened = [];

  const shouldSkipLevel0 =
    categories.length === 1 &&
    categories[0].children.length > 0;

  const effectiveCategories = shouldSkipLevel0 ? categories[0].children : categories;

  const recurse = (cats, depth, groupingParentId = null) => {
    cats.forEach((cat) => {
      const parentIdForChildren = depth === 0 ? cat.id : groupingParentId;
      const isLeaf = !cat.children?.length;

      if (isLeaf) {
        flattened.push({
          ...cat,
          children: [],
          topLevelParentId: depth === 0 ? null : groupingParentId,
        });
      } else {
        recurse(cat.children, depth + 1, parentIdForChildren);
      }
    });
  };

  recurse(effectiveCategories, 0, null);
  return flattened;
};

/**
 * Build hierarchical category structure for nested grid headers.
 * Groups leaf categories under their parent for colspan display.
 */
const buildCategoryHierarchy = (categories, flatCategories) => {
  if (!categories?.length) return [];

  const shouldSkipLevel0 =
    categories.length === 1 &&
    categories[0].children.length > 0;

  const groupingCategories = shouldSkipLevel0
    ? categories[0].children
    : categories;

  const categoriesByParent = {};
  flatCategories.forEach((cat) => {
    const parentId = cat.topLevelParentId || "root";
    if (!categoriesByParent[parentId]) {
      categoriesByParent[parentId] = [];
    }
    categoriesByParent[parentId].push(cat);
  });

  return groupingCategories.map((groupCat) => {
    const descendantLeaves = categoriesByParent[groupCat.id] || [];
    const isLeaf = descendantLeaves.length === 0;
    const leaves = isLeaf ? [groupCat] : descendantLeaves;

    const earnedCredits = leaves.reduce((sum, leaf) => sum + (leaf.earnedCredits || 0), 0);
    const plannedCredits = leaves.reduce((sum, leaf) => sum + (leaf.plannedCredits || 0), 0);
    const totalCredits = earnedCredits + plannedCredits;
    const targetCredits = groupCat.maxCredits || groupCat.minCredits || 0;
    const isComplete = targetCredits > 0 && (earnedCredits + plannedCredits) >= targetCredits;

    return {
      id: groupCat.id,
      name: groupCat.name,
      path: groupCat.path,
      colspan: Math.max(1, leaves.length),
      isLeaf,
      minCredits: groupCat.minCredits,
      maxCredits: groupCat.maxCredits,
      earnedCredits,
      plannedCredits,
      totalCredits,
      isComplete,
      children: leaves.map((leaf) => ({
        id: leaf.id,
        name: leaf.name,
        path: leaf.path,
        minCredits: leaf.minCredits,
        maxCredits: leaf.maxCredits,
        earnedCredits: leaf.earnedCredits,
        plannedCredits: leaf.plannedCredits,
        validClassifications: leaf.validClassifications,
      })),
    };
  });
};

/**
 * Match a course classification to a category using direct name match,
 * then fuzzy keyword match as fallback.
 *
 * @returns {object|undefined} The matched category, or undefined if no match
 */
const matchClassificationToCategory = (classification, flatCategories) => {
  const lowerClassification = classification.toLowerCase();

  return (
    flatCategories.find(
      (cat) => cat.name.toLowerCase() === lowerClassification
    ) ||
    flatCategories.find((cat) =>
      cat.validClassifications.some(
        (vc) =>
          vc.toLowerCase() === lowerClassification ||
          lowerClassification.includes(vc.toLowerCase())
      )
    )
  );
};

/**
 * Estimate completion semester based on credits and planned courses
 */
const estimateCompletion = (required, earned, planned, semesters) => {
  if (earned >= required) return "Completed";

  const remaining = required - earned;
  const avgCreditsPerSemester =
    semesters.length > 0
      ? semesters.reduce((sum, s) => sum + s.totalCredits, 0) / semesters.length
      : 30;

  const semestersNeeded = Math.ceil(remaining / Math.max(avgCreditsPerSemester, 15));
  const futureSems = semesters.filter((s) => s.status === "future");

  if (futureSems.length >= semestersNeeded) {
    return futureSems[semestersNeeded - 1]?.key || "TBD";
  }

  const lastSemester = semesters[semesters.length - 1];
  if (!lastSemester) return "TBD";

  const parsed = parseSemesterKey(lastSemester.key);
  let projectedYear = parsed.year;
  let isHS = parsed.type === "HS";

  for (let i = 0; i < semestersNeeded - futureSems.length; i++) {
    if (!isHS) projectedYear++;
    isHS = !isHS;
  }

  return `${isHS ? "HS" : "FS"}${projectedYear}`;
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
      return { isReady: false, mainProgramId: null, rawScorecard: null, categories: [], flatCategories: [], completedCourses: [] };
    }

    const mainProgramId = findMainProgram(
      Object.fromEntries(
        Object.entries(academicData.programs).map(([id, p]) => [
          id,
          { isMainStudy: p.metadata?.isMainStudy },
        ])
      )
    );

    if (!mainProgramId) {
      return { isReady: false, mainProgramId: null, rawScorecard: null, categories: [], flatCategories: [], completedCourses: [] };
    }

    const mainProgram = academicData.programs[mainProgramId];
    const rawScorecard = mainProgram?.transcript?.rawScorecard;

    const categories = rawScorecard?.items
      ? extractCategoryHierarchy(rawScorecard.items)
      : [];

    if (import.meta.env.DEV && categories.length > 0) {
      const shouldSkipLevel0 = categories.length === 1 && categories[0].children.length > 0;
      const effectiveParents = shouldSkipLevel0 ? categories[0].children : categories;
      const totalDepth = getHierarchyDepth(categories);
      console.log("[CurriculumMap] Category hierarchy structure:", {
        totalDepth,
        skippingProgramWrapper: shouldSkipLevel0,
        programName: shouldSkipLevel0 ? categories[0].name : "(none)",
        effectiveGroupingParents: effectiveParents.map(c => ({
          name: c.name,
          level: c.level,
          hasChildren: c.children.length > 0,
          childCount: c.children.length,
          children: c.children.map(ch => ch.name)
        }))
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
    const localSelectedCourses = get(localSelectedCoursesSemKeyState);
    const curriculumPlan = get(curriculumPlanState);

    if (!categoryStructure.isReady) {
      return createEmptyResult(
        categoryStructure.mainProgramId !== null,
        curriculumPlan.validations
      );
    }

    const { mainProgramId, rawScorecard, categories, flatCategories, completedCourses } =
      categoryStructure;

    // ── Collect all semester keys ──────────────────────────────────────────
    const allSemesterKeys = new Set();

    completedCourses.forEach((c) => allSemesterKeys.add(normalizeSemesterKey(c.semester)));
    Object.keys(localSelectedCourses).forEach((k) => allSemesterKeys.add(normalizeSemesterKey(k)));
    Object.keys(curriculumPlan.plannedItems || {}).forEach((k) =>
      allSemesterKeys.add(normalizeSemesterKey(k))
    );
    Object.keys(unifiedCourseData.semesters || {}).forEach((k) =>
      allSemesterKeys.add(normalizeSemesterKey(k))
    );

    const sortedSemesters = sortSemesters(Array.from(allSemesterKeys));

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
          (c) => c.path === catPath || catPath.startsWith(c.path)
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
    Object.entries(localSelectedCourses).forEach(([semKey, courses]) => {
      if (!coursesBySemesterAndCategory[semKey]) return;

      // Per-plan wishlist overrides: skip courses hidden in the active plan
      const removedIds =
        curriculumPlan.wishlistOverrides?.[semKey]?.removedCourseIds || [];

      const availableCourses = unifiedCourseData.semesters?.[semKey]?.available || [];

      courses.forEach((course) => {
        const courseId = course.id || course.courseNumber;
        if (removedIds.includes(courseId)) return;
        const fullCourse = availableCourses.find(
          (c) =>
            c.courseNumber === course.id ||
            c.id === course.id ||
            c.courseNumber === course.courseNumber
        );

        const classification =
          course.classification ||
          fullCourse?.classification ||
          course.big_type ||
          "elective";

        // Use stored categoryPath first (from drag-and-drop), validate it exists
        let targetCatPath = course.categoryPath;

        if (targetCatPath && !flatCategories.some((cat) => cat.path === targetCatPath)) {
          targetCatPath = null;
        }

        // Fallback to classification matching
        if (!targetCatPath) {
          const matchedCat = matchClassificationToCategory(classification, flatCategories);
          targetCatPath = matchedCat?.path || flatCategories[0]?.path;

          if (import.meta.env.DEV && !matchedCat) {
            console.warn(
              `[CurriculumMap] No category match for course "${course.shortName || course.id}"`,
              `\n  Classification: "${classification}"`,
              `\n  Available categories:`,
              flatCategories.map((c) => `${c.name} [${c.validClassifications.join(", ")}]`)
            );
          }
        }

        if (targetCatPath && coursesBySemesterAndCategory[semKey][targetCatPath]) {
          // Idempotent normalization: handles both pre-normalized (6) and raw API (600) credits
          const rawCredits = course.credits ?? fullCourse?.credits ?? 300;
          const normalizedCredits = rawCredits > 99 ? rawCredits / 100 : rawCredits;

          coursesBySemesterAndCategory[semKey][targetCatPath].push({
            id: course.id || course.courseNumber,
            courseId: course.id || course.courseNumber,
            name: course.shortName || fullCourse?.shortName || course.id,
            credits: normalizedCredits,
            semester: semKey,
            categoryPath: targetCatPath,
            status: "planned",
            isCompleted: false,
            isPlanned: true,
            classification,
            source: "wishlist",
            calendarEntry: course.calendarEntry || fullCourse?.calendarEntry,
          });
        }
      });
    });

    // ── Place enrolled courses ────────────────────────────────────────────
    Object.entries(unifiedCourseData.semesters || {}).forEach(([semKey, semData]) => {
      const normalizedSemKey = normalizeSemesterKey(semKey);
      if (!coursesBySemesterAndCategory[normalizedSemKey]) return;

      const enrolledIds = semData.enrolledIds || [];
      const availableCourses = semData.available || [];

      enrolledIds.forEach((enrolledId) => {
        const alreadyExists = Object.values(coursesBySemesterAndCategory[normalizedSemKey])
          .flat()
          .some((c) => c.id === enrolledId || c.courseId === enrolledId);

        if (alreadyExists) return;

        const fullCourse = availableCourses.find(
          (c) => c.courseNumber === enrolledId || c.id === enrolledId
        );

        if (!fullCourse) return;

        const classification = fullCourse.classification || fullCourse.big_type || "elective";

        const matchedCat = matchClassificationToCategory(classification, flatCategories);
        const targetCatPath = matchedCat?.path || flatCategories[0]?.path;

        if (import.meta.env.DEV && !matchedCat) {
          console.warn(
            `[CurriculumMap] No category match for enrolled course "${fullCourse.shortName || enrolledId}"`,
            `\n  Classification: "${classification}"`,
            `\n  Available categories:`,
            flatCategories.map((c) => `${c.name} [${c.validClassifications.join(", ")}]`)
          );
        }

        if (targetCatPath && coursesBySemesterAndCategory[normalizedSemKey][targetCatPath]) {
          coursesBySemesterAndCategory[normalizedSemKey][targetCatPath].push({
            id: enrolledId,
            courseId: enrolledId,
            name: fullCourse.shortName || fullCourse.description || enrolledId,
            credits: (fullCourse.credits || 300) / 100,
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
    });

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
          const targetCatPath =
            item.categoryPath || flatCategories[0]?.path || "";

          if (coursesBySemesterAndCategory[semKey][targetCatPath]) {
            if (item.type === "placeholder") {
              coursesBySemesterAndCategory[semKey][targetCatPath].push({
                id: item.id,
                name: item.label || "TBD",
                credits: item.credits,
                semester: semKey,
                categoryPath: targetCatPath,
                status: "placeholder",
                isPlaceholder: true,
                source: "plan",
              });
            } else if (item.type === "course") {
              const availableCourses =
                unifiedCourseData.semesters?.[semKey]?.available || [];
              const fullCourse = availableCourses.find(
                (c) =>
                  c.courseNumber === item.courseId || c.id === item.courseId
              );

              coursesBySemesterAndCategory[semKey][targetCatPath].push({
                id: item.courseId,
                courseId: item.courseId,
                name: fullCourse?.shortName || item.shortName || item.courseId,
                credits: fullCourse
                  ? (fullCourse.credits || 300) / 100
                  : 3,
                semester: semKey,
                categoryPath: targetCatPath,
                status: "planned",
                isCompleted: false,
                isPlanned: true,
                source: "plan",
                calendarEntry: fullCourse?.calendarEntry,
              });
            }
          }
        });
      }
    );

    // ── Exercise group credit normalization ───────────────────────────────
    sortedSemesters.forEach((semKey) => {
      const allSemesterCourses = Object.values(
        coursesBySemesterAndCategory[semKey] || {}
      ).flat();

      if (allSemesterCourses.length === 0) return;

      const processedCourses = processExerciseGroupECTS(allSemesterCourses);

      const processedCreditsMap = new Map();
      processedCourses.forEach((course) => {
        const courseId = course.id || course.courseId;
        if (courseId) {
          processedCreditsMap.set(courseId, course.credits);
        }
      });

      Object.keys(coursesBySemesterAndCategory[semKey]).forEach((catPath) => {
        coursesBySemesterAndCategory[semKey][catPath] = coursesBySemesterAndCategory[semKey][catPath].map((course) => {
          const courseId = course.id || course.courseId;
          if (courseId && processedCreditsMap.has(courseId)) {
            return { ...course, credits: processedCreditsMap.get(courseId) };
          }
          return course;
        });
      });
    });

    // ── Calculate semester stats ──────────────────────────────────────────
    const semesters = sortedSemesters.map((semKey) => {
      const semesterCourses = Object.values(
        coursesBySemesterAndCategory[semKey] || {}
      ).flat();
      const totalCredits = semesterCourses.reduce(
        (sum, c) => sum + (c.credits || 0),
        0
      );
      const completedCredits = semesterCourses
        .filter((c) => c.isCompleted)
        .reduce((sum, c) => sum + (c.credits || 0), 0);

      return {
        key: semKey,
        status: getSemesterStatus(semKey),
        totalCredits,
        completedCredits,
        plannedCredits: totalCredits - completedCredits,
        courseCount: semesterCourses.length,
        note: curriculumPlan.semesterNotes?.[semKey] || "",
      };
    });

    // ── Calculate category credit totals ──────────────────────────────────
    const categoriesWithCredits = flatCategories.map((cat) => {
      const earnedCredits = cat.earnedCredits || 0;
      let plannedCredits = 0;

      sortedSemesters.forEach((semKey) => {
        const courses = coursesBySemesterAndCategory[semKey]?.[cat.path] || [];
        courses.forEach((course) => {
          if (course.source !== "transcript") {
            plannedCredits += course.credits || 0;
          }
        });
      });

      return {
        ...cat,
        earnedCredits,
        plannedCredits,
        totalCredits: earnedCredits + plannedCredits,
        isComplete: (earnedCredits + plannedCredits) >= (cat.maxCredits || cat.minCredits || 0),
        isOverfilled: earnedCredits + plannedCredits > (cat.maxCredits || 0),
      };
    });

    // ── Calculate program stats ───────────────────────────────────────────
    const totalEarned = categoriesWithCredits.reduce(
      (sum, c) => sum + c.earnedCredits,
      0
    );
    const totalPlanned = categoriesWithCredits.reduce(
      (sum, c) => sum + c.plannedCredits,
      0
    );
    const totalRequired = parseFloat(rawScorecard?.items?.[0]?.maxCredits) || 180;

    // ── Build hierarchy for nested headers ────────────────────────────────
    const categoryHierarchy = buildCategoryHierarchy(categories, categoriesWithCredits);

    if (import.meta.env.DEV && categoryHierarchy.length > 0) {
      const hasNestedHeaders = categoryHierarchy.some(p => p.children.length > 1);
      console.log("[CurriculumMap] Hierarchy result:", {
        hasNestedHeaders,
        parents: categoryHierarchy.map(p => ({
          name: p.name,
          colspan: p.colspan,
          isLeaf: p.isLeaf,
          childCount: p.children.length,
          children: p.children.map(c => c.name)
        }))
      });
    }

    return {
      isLoaded: true,
      program: {
        id: mainProgramId,
        name: mainProgramId,
        totalRequired,
        totalEarned,
        totalPlanned,
        completionPercentage: Math.round((totalEarned / totalRequired) * 100),
        estimatedCompletion: estimateCompletion(
          totalRequired,
          totalEarned,
          totalPlanned,
          semesters
        ),
      },
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
// Classification matching — exported for drag-and-drop suggestion highlighting
// ────────────────────────────────────────────────────────────────────────────

/**
 * Check if a course classification matches a specific category.
 * Uses the same matching logic as matchClassificationToCategory:
 * 1. Direct name match (case-insensitive)
 * 2. Fuzzy keyword match via validClassifications
 *
 * @param {string} classification - The course's classification string
 * @param {string} categoryName - The category name to check against
 * @param {string[]} validClassifications - The category's valid classification keywords
 * @returns {boolean}
 */
export const doesClassificationMatchCategory = (classification, categoryName, validClassifications) => {
  if (!classification || !validClassifications) return false;
  const lower = classification.toLowerCase();
  return (
    categoryName.toLowerCase() === lower ||
    validClassifications.some(
      (vc) => vc.toLowerCase() === lower || lower.includes(vc.toLowerCase())
    )
  );
};

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
  matchClassificationToCategory,
  estimateCompletion,
};
