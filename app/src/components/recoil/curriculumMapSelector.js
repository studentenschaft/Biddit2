import { selector } from "recoil";
import { unifiedAcademicDataState } from "./unifiedAcademicDataAtom";
import { unifiedCourseDataState } from "./unifiedCourseDataAtom";
import { localSelectedCoursesSemKeyState } from "./localSelectedCoursesSemKeyAtom";
import { curriculumPlanState, sortSemesters, parseSemesterKey } from "./curriculumPlanAtom";
import { findMainProgram } from "../helpers/academicDataTransformers";

/**
 * Curriculum Map Selector
 *
 * Combines data from multiple sources into a unified grid-ready structure:
 * 1. Scorecard hierarchy (categories & credit requirements) from transcript
 * 2. Completed courses from transcript
 * 3. Current wishlist courses from localSelectedCoursesSemKeyState
 * 4. Future planned items from curriculumPlanState
 *
 * Output is optimized for rendering a 2D grid: rows = semesters, columns = categories
 */

/**
 * Extract the hierarchical category structure from scorecard
 * Recursively processes the scorecard items to build a flat + hierarchical structure
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
        // Classification values that map to this category
        validClassifications: extractClassifications(item),
        // Will be populated when processing courses
        plannedCredits: 0,
        children: [],
      };

      // Recursively process children
      if (item.items && Array.isArray(item.items)) {
        category.children = extractCategoryHierarchy(item.items, path, level + 1);
      }

      categories.push(category);
    }
  });

  return categories;
};

/**
 * Extract classification values that should map to this category
 * Uses category name/description patterns to infer valid classifications
 */
const extractClassifications = (categoryItem) => {
  const classifications = [];
  const name = (categoryItem.description || categoryItem.shortName || "").toLowerCase();

  // Map common category names to course classification values
  if (name.includes("compulsory") || name.includes("pflicht")) {
    classifications.push("compulsory", "pflicht", "Pflichtbereich");
  }
  if (name.includes("elective") || name.includes("wahl")) {
    classifications.push("elective", "wahl", "Wahlbereich", "Elective");
  }
  if (name.includes("context") || name.includes("kontext")) {
    classifications.push("context", "kontext", "Contextual Studies");
  }
  if (name.includes("method") || name.includes("forschung")) {
    classifications.push("method", "forschung", "Research Methods");
  }
  if (name.includes("thesis") || name.includes("arbeit")) {
    classifications.push("thesis", "masterarbeit", "bachelorarbeit", "Thesis");
  }
  if (name.includes("project") || name.includes("projekt")) {
    classifications.push("project", "projekt", "Projects");
  }
  if (name.includes("core") || name.includes("kern")) {
    classifications.push("core", "kern", "Core");
  }

  return classifications;
};

/**
 * Extract courses (non-title items) with their semester and category info
 */
const extractCoursesFromHierarchy = (items, categoryPath = "", parentHierarchy = "") => {
  const courses = [];

  (items || []).forEach((item) => {
    if (item.isTitle) {
      // Recurse into subcategories
      const subPath = categoryPath
        ? `${categoryPath}/${item.description || item.shortName}`
        : item.description || item.shortName;

      if (item.items) {
        courses.push(
          ...extractCoursesFromHierarchy(item.items, subPath, item.hierarchy)
        );
      }
    } else if (!item.isTitle && item.semester) {
      // This is a course
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
 * Determine semester status based on current date
 */
const getSemesterStatus = (semesterKey) => {
  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth();

  // HSG: HS = September-February, FS = February-July
  const isCurrentlyHS = currentMonth >= 8 || currentMonth <= 1;
  const currentSemType = isCurrentlyHS ? "HS" : "FS";
  const currentSemYear = isCurrentlyHS && currentMonth <= 1 ? currentYear - 1 : currentYear;
  const currentSemKey = `${currentSemType}${currentSemYear}`;

  const parsed = parseSemesterKey(semesterKey);
  const parsedCurrent = parseSemesterKey(currentSemKey);

  // Compare
  if (parsed.fullYear < parsedCurrent.fullYear) return "completed";
  if (parsed.fullYear > parsedCurrent.fullYear) return "future";

  // Same year
  if (semesterKey === currentSemKey) return "current";

  // Different semester type same year: FS comes before HS
  if (parsed.type === "FS" && parsedCurrent.type === "HS") return "completed";
  if (parsed.type === "HS" && parsedCurrent.type === "FS") return "future";

  return "completed"; // fallback
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
 * Flatten categories for grid columns
 * Returns only the deepest meaningful categories (leaf nodes)
 * Tracks the GROUPING parent (level 1) for proper hierarchy display
 *
 * Special handling: If level 0 is just the program name (single category with children),
 * we skip it and use level 1 as the grouping parents instead.
 *
 * Depth is calculated dynamically - we flatten to true leaf categories
 * (those with no children), not an arbitrary depth.
 */
const flattenCategoriesForGrid = (categories) => {
  const flattened = [];

  // Check if level 0 is just a single program wrapper (should skip it)
  const shouldSkipLevel0 =
    categories.length === 1 &&
    categories[0].children.length > 0;

  // If skipping level 0, start recursion from its children at effective depth 0
  const effectiveCategories = shouldSkipLevel0 ? categories[0].children : categories;

  const recurse = (cats, depth, groupingParentId = null) => {
    cats.forEach((cat) => {
      // At depth 0 (effective), this category is a grouping parent for its descendants
      const parentIdForChildren = depth === 0 ? cat.id : groupingParentId;

      // A category is a leaf if it has no children - flatten to true leaves
      const isLeaf = !cat.children?.length;

      if (isLeaf) {
        // This is a leaf category - add to flattened list
        flattened.push({
          ...cat,
          children: [],
          // Track the grouping parent (null if this IS a depth-0 category with no children)
          topLevelParentId: depth === 0 ? null : groupingParentId,
        });
      } else {
        // Go deeper, preserving the grouping parent reference
        recurse(cat.children, depth + 1, parentIdForChildren);
      }
    });
  };

  recurse(effectiveCategories, 0, null);
  return flattened;
};

/**
 * Build hierarchical category structure for nested grid headers
 * Returns grouping categories with colspan info and their leaf children
 *
 * Special handling: If level 0 is just a single program wrapper,
 * we use level 1 categories as the grouping parents instead.
 */
const buildCategoryHierarchy = (categories, flatCategories) => {
  if (!categories?.length) return [];

  // Check if level 0 is just a single program wrapper (should skip it)
  const shouldSkipLevel0 =
    categories.length === 1 &&
    categories[0].children.length > 0;

  // Use effective grouping categories (level 1 if skipping program wrapper)
  const groupingCategories = shouldSkipLevel0
    ? categories[0].children
    : categories;

  // Group flat categories by their grouping parent
  const categoriesByParent = {};
  flatCategories.forEach((cat) => {
    const parentId = cat.topLevelParentId || "root";
    if (!categoriesByParent[parentId]) {
      categoriesByParent[parentId] = [];
    }
    categoriesByParent[parentId].push(cat);
  });

  // Build hierarchy: grouping categories that span their leaf descendants
  const hierarchy = groupingCategories.map((groupCat) => {
    // Find all leaf categories that descend from this grouping category
    const descendantLeaves = categoriesByParent[groupCat.id] || [];

    // If this category has no descendants in the flat list,
    // it IS itself a leaf (no subcategories)
    const isLeaf = descendantLeaves.length === 0;
    const leaves = isLeaf ? [groupCat] : descendantLeaves;

    return {
      id: groupCat.id,
      name: groupCat.name,
      path: groupCat.path,
      colspan: Math.max(1, leaves.length),
      isLeaf,
      minCredits: groupCat.minCredits,
      maxCredits: groupCat.maxCredits,
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

  return hierarchy;
};

/**
 * Main curriculum map selector
 */
export const curriculumMapSelector = selector({
  key: "curriculumMapSelector",
  get: ({ get }) => {
    const academicData = get(unifiedAcademicDataState);
    const unifiedCourseData = get(unifiedCourseDataState);
    const localSelectedCourses = get(localSelectedCoursesSemKeyState);
    const curriculumPlan = get(curriculumPlanState);

    // Early return if data not loaded
    if (!academicData.initialization?.isInitialized || !academicData.programs) {
      return {
        isLoaded: false,
        program: null,
        categories: [],
        flatCategories: [],
        categoryHierarchy: [],
        semesters: [],
        coursesBySemesterAndCategory: {},
        validations: curriculumPlan.validations,
      };
    }

    // Find main program
    const mainProgramId = findMainProgram(
      Object.fromEntries(
        Object.entries(academicData.programs).map(([id, p]) => [
          id,
          { isMainStudy: p.metadata?.isMainStudy },
        ])
      )
    );

    if (!mainProgramId) {
      return {
        isLoaded: true,
        program: null,
        categories: [],
        flatCategories: [],
        categoryHierarchy: [],
        semesters: [],
        coursesBySemesterAndCategory: {},
        validations: curriculumPlan.validations,
      };
    }

    const mainProgram = academicData.programs[mainProgramId];
    const rawScorecard = mainProgram?.transcript?.rawScorecard;

    // Extract category hierarchy from scorecard
    const categories = rawScorecard?.items
      ? extractCategoryHierarchy(rawScorecard.items)
      : [];

    // Debug: Log the extracted hierarchy structure
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

    // Flatten categories for grid columns (dynamically finds true leaf categories)
    const flatCategories = flattenCategoriesForGrid(categories);

    // Extract completed courses from scorecard hierarchy
    const completedCourses = rawScorecard?.items
      ? extractCoursesFromHierarchy(rawScorecard.items)
      : [];

    // Collect all semesters from: completed courses + wishlist + planned items
    const allSemesterKeys = new Set();

    completedCourses.forEach((c) => allSemesterKeys.add(c.semester));
    Object.keys(localSelectedCourses).forEach((k) => allSemesterKeys.add(k));
    Object.keys(curriculumPlan.plannedItems || {}).forEach((k) =>
      allSemesterKeys.add(k)
    );
    Object.keys(unifiedCourseData.semesters || {}).forEach((k) =>
      allSemesterKeys.add(k)
    );

    // Sort semesters chronologically
    const sortedSemesters = sortSemesters(Array.from(allSemesterKeys));

    // Build the course grid: { "semesterKey": { "categoryPath": [courses] } }
    const coursesBySemesterAndCategory = {};

    // Initialize grid structure
    sortedSemesters.forEach((semKey) => {
      coursesBySemesterAndCategory[semKey] = {};
      flatCategories.forEach((cat) => {
        coursesBySemesterAndCategory[semKey][cat.path] = [];
      });
    });

    // Place completed courses into grid
    completedCourses.forEach((course) => {
      const semKey = course.semester;
      const catPath = course.categoryPath;

      if (coursesBySemesterAndCategory[semKey]) {
        // Find matching category
        const matchedCat = flatCategories.find(
          (c) => c.path === catPath || catPath.startsWith(c.path)
        );
        if (matchedCat) {
          coursesBySemesterAndCategory[semKey][matchedCat.path].push({
            ...course,
            source: "transcript",
          });
        }
      }
    });

    // Place wishlist courses into grid
    Object.entries(localSelectedCourses).forEach(([semKey, courses]) => {
      if (!coursesBySemesterAndCategory[semKey]) return;

      const availableCourses = unifiedCourseData.semesters?.[semKey]?.available || [];

      courses.forEach((course) => {
        // Enrich with full course data if available
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

        // Use stored categoryPath first (from drag-and-drop), fallback to classification match
        let targetCatPath = course.categoryPath;

        // Validate stored categoryPath exists in flatCategories
        if (targetCatPath && !flatCategories.some((cat) => cat.path === targetCatPath)) {
          targetCatPath = null;
        }

        // Fallback to classification matching if no stored path
        if (!targetCatPath) {
          const matchedCat = flatCategories.find((cat) =>
            cat.validClassifications.some(
              (vc) =>
                vc.toLowerCase() === classification.toLowerCase() ||
                classification.toLowerCase().includes(vc.toLowerCase())
            )
          );
          targetCatPath = matchedCat?.path || flatCategories[0]?.path;
        }

        if (targetCatPath && coursesBySemesterAndCategory[semKey][targetCatPath]) {
          coursesBySemesterAndCategory[semKey][targetCatPath].push({
            id: course.id || course.courseNumber,
            courseId: course.id || course.courseNumber,
            name: course.shortName || fullCourse?.shortName || course.id,
            credits: (course.credits ?? fullCourse?.credits ?? 300) / 100,
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

    // Place curriculum plan items into grid
    Object.entries(curriculumPlan.plannedItems || {}).forEach(
      ([semKey, items]) => {
        if (!coursesBySemesterAndCategory[semKey]) {
          // Create entry for new future semester
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
              // Future planned course - try to enrich
              const availableCourses =
                unifiedCourseData.semesters?.[semKey]?.available || [];
              const fullCourse = availableCourses.find(
                (c) =>
                  c.courseNumber === item.courseId || c.id === item.courseId
              );

              coursesBySemesterAndCategory[semKey][targetCatPath].push({
                id: item.courseId,
                courseId: item.courseId,
                name: fullCourse?.shortName || item.courseId,
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

    // Calculate semester-level stats
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
      };
    });

    // Calculate category-level credit totals
    const categoriesWithCredits = flatCategories.map((cat) => {
      let earnedCredits = 0;
      let plannedCredits = 0;

      sortedSemesters.forEach((semKey) => {
        const courses = coursesBySemesterAndCategory[semKey]?.[cat.path] || [];
        courses.forEach((course) => {
          if (course.isCompleted) {
            earnedCredits += course.credits || 0;
          } else {
            plannedCredits += course.credits || 0;
          }
        });
      });

      return {
        ...cat,
        earnedCredits,
        plannedCredits,
        totalCredits: earnedCredits + plannedCredits,
        isComplete: earnedCredits >= cat.maxCredits,
        isOverfilled: earnedCredits + plannedCredits > cat.maxCredits,
      };
    });

    // Calculate program-level stats
    const totalEarned = categoriesWithCredits.reduce(
      (sum, c) => sum + c.earnedCredits,
      0
    );
    const totalPlanned = categoriesWithCredits.reduce(
      (sum, c) => sum + c.plannedCredits,
      0
    );
    const totalRequired = parseFloat(rawScorecard?.items?.[0]?.maxCredits) || 180;

    // Build hierarchical structure for nested headers
    const categoryHierarchy = buildCategoryHierarchy(categories, categoriesWithCredits);

    // Debug: Log hierarchy info to understand nested header behavior
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
  const futureSemesters = semesters.filter((s) => s.status === "future");

  if (futureSemesters.length >= semestersNeeded) {
    return futureSemesters[semestersNeeded - 1]?.key || "TBD";
  }

  // Project beyond known semesters
  const lastSemester = semesters[semesters.length - 1];
  if (!lastSemester) return "TBD";

  const parsed = parseSemesterKey(lastSemester.key);
  let projectedYear = parsed.year;
  let isHS = parsed.type === "HS";

  for (let i = 0; i < semestersNeeded - futureSemesters.length; i++) {
    if (!isHS) projectedYear++;
    isHS = !isHS;
  }

  return `${isHS ? "HS" : "FS"}${projectedYear}`;
};

/**
 * Selector for just the flat category list (useful for CoursePicker)
 */
export const curriculumCategoriesSelector = selector({
  key: "curriculumCategoriesSelector",
  get: ({ get }) => {
    const mapData = get(curriculumMapSelector);
    return mapData.flatCategories;
  },
});

/**
 * Selector for semester list with stats
 */
export const curriculumSemestersSelector = selector({
  key: "curriculumSemestersSelector",
  get: ({ get }) => {
    const mapData = get(curriculumMapSelector);
    return mapData.semesters;
  },
});

/**
 * Selector for program overview stats
 */
export const curriculumProgramSelector = selector({
  key: "curriculumProgramSelector",
  get: ({ get }) => {
    const mapData = get(curriculumMapSelector);
    return mapData.program;
  },
});
