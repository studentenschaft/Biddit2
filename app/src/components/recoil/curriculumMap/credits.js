import { nextSemesterKey, semesterStatus } from "../../../domain/semester";
import { processExerciseGroupECTS } from "../../helpers/smartExerciseGroupHandler";
import { sameCourse } from "../../../domain/course";

/**
 * Resolve a course's raw credits from ANY loaded semester catalog.
 *
 * A course is placed under one semester, but its credits are only resolvable if
 * that semester's catalog is loaded. Projected future semesters (and terms whose
 * catalog errors) have no catalog, so a course there can't resolve locally — even
 * though the same course number exists in another loaded catalog (a course's ECTS
 * is stable across terms). This is the last-resort lookup for that case.
 */
export const findCreditsInAnySemester = (courseId, semesters) => {
  if (!courseId) return null;
  for (const semData of Object.values(semesters || {})) {
    const hit = (semData?.available || []).find((c) =>
      sameCourse(c, { id: courseId }),
    );
    if (hit && hit.credits != null) return hit.credits;
  }
  return null;
};

// ────────────────────────────────────────────────────────────────────────────
// Credit requirements
//
// A scorecard requirement node encodes a RANGE, not a single target:
// `minCredits` is the floor you must reach, `maxCredits` the ceiling that
// counts toward the parent. Anything above the ceiling is earned but does not
// count.
//
// A `maxCredits` of 0 means "no ceiling", NOT "counts for nothing" — the
// university's own roll-up confirms it: in Scorecard_BBWL, Contextual Studies
// reports sumOfCredits 13, which includes all 4 credits from its Languages
// child even though that child is min 0 / max 0. Such a node simply carries
// neither a floor nor a ceiling.
// ────────────────────────────────────────────────────────────────────────────

/** Credits a category must reach to count as satisfied. 0 = no requirement. */
export const getRequirementThreshold = ({
  minCredits = 0,
  maxCredits = 0,
} = {}) => (minCredits > 0 ? minCredits : maxCredits || 0);

const getTotal = ({ earnedCredits = 0, plannedCredits = 0 } = {}) =>
  earnedCredits + plannedCredits;

/**
 * True when a category has a real requirement and meets it. Drives the green
 * treatment, so a category with no requirement is never "complete".
 */
export const meetsRequirement = (category) => {
  const threshold = getRequirementThreshold(category);
  return threshold > 0 && getTotal(category) >= threshold;
};

/**
 * True when a category has an explicit minimum and is below it. Drives the
 * parent gate.
 *
 * Keys off `minCredits` alone, NOT `getRequirementThreshold`: a maximum is a
 * ceiling, not an obligation, so a min-0/max-12 bucket ("Skills") sitting at 4
 * is under-filled but not deficient and must not hold its parent back.
 *
 * Consequently this is not the negation of `meetsRequirement` — a category can
 * both fail to be complete and fail to fall short. That asymmetry is what keeps
 * parents of unconstrained leaves reachable.
 */
export const fallsShort = (category) =>
  (category?.minCredits || 0) > 0 && getTotal(category) < category.minCredits;

/** A category's ceiling. `Infinity` when it declares none. */
const getCreditCap = ({ maxCredits = 0 } = {}) =>
  maxCredits > 0 ? maxCredits : Infinity;

/**
 * Roll leaves up into a parent. Each leaf contributes at most its own ceiling;
 * the remainder is reported as `excessCredits` rather than inflating the total.
 */
export const summarizeLeafCredits = (leaves = []) =>
  leaves.reduce(
    (acc, leaf) => {
      const total = getTotal(leaf);
      const counted = Math.min(total, getCreditCap(leaf));

      acc.countedTotal += counted;
      acc.excessCredits += total - counted;
      acc.allLeavesMeetRequirement =
        acc.allLeavesMeetRequirement && !fallsShort(leaf);
      return acc;
    },
    { countedTotal: 0, excessCredits: 0, allLeavesMeetRequirement: true },
  );

/** "12–27" for a range, "15" when the bounds coincide, "" when unconstrained. */
export const formatCreditRange = ({ minCredits = 0, maxCredits = 0 } = {}) => {
  if (!minCredits && !maxCredits) return "";
  if (!minCredits || !maxCredits || minCredits === maxCredits) {
    return String(getRequirementThreshold({ minCredits, maxCredits }));
  }
  return `${minCredits}–${maxCredits}`;
};

/**
 * Progress bar fill, denominated by the completion threshold so the bar reaches
 * 100% exactly when the requirement is met. A category with min 12 / max 24
 * sitting at 20 therefore shows a full bar while its label still advertises 24
 * — intended: the bar tracks the requirement, the label shows the range.
 */
export const getFillPercentage = (counted, category) => {
  const threshold = getRequirementThreshold(category);
  return threshold > 0
    ? Math.min(100, Math.round((counted / threshold) * 100))
    : 0;
};

/**
 * Build hierarchical category structure for nested grid headers.
 * Groups leaf categories under their parent for colspan display.
 */
export const buildCategoryHierarchy = (categories, flatCategories) => {
  if (!categories?.length) return [];

  const shouldSkipLevel0 =
    categories.length === 1 && categories[0].children.length > 0;

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

    const {
      countedTotal: leafTotal,
      excessCredits: leafExcess,
      allLeavesMeetRequirement,
    } = summarizeLeafCredits(leaves);

    // The parent has a ceiling of its own, so credits can be lost twice: once
    // to a child's cap, then again to the parent's. Both surface in the badge.
    const countedTotal = Math.min(leafTotal, getCreditCap(groupCat));
    const excessCredits = leafExcess + (leafTotal - countedTotal);

    // Complete only when the credits that actually count meet this node's own
    // requirement AND no leaf below it is short of its own minimum. Without the
    // second condition an over-filled category masks a starved sibling.
    const targetCredits = getRequirementThreshold(groupCat);
    const isComplete =
      targetCredits > 0 &&
      countedTotal >= targetCredits &&
      allLeavesMeetRequirement;

    return {
      id: groupCat.id,
      name: groupCat.name,
      path: groupCat.path,
      colspan: Math.max(1, leaves.length),
      isLeaf,
      minCredits: groupCat.minCredits,
      maxCredits: groupCat.maxCredits,
      countedTotal,
      excessCredits,
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
 * Credit stats for one semester's courses.
 *
 * `plannedCredits` counts only wishlist courses and placeholders — courses the
 * user merely intends to take. Enrolled (in-progress) courses are real
 * commitments: they count toward `totalCredits` but never toward planned.
 */
export const computeSemesterCreditStats = (semesterCourses) => {
  const sumCredits = (courses) =>
    courses.reduce((sum, c) => sum + (c.credits || 0), 0);

  return {
    totalCredits: sumCredits(semesterCourses),
    completedCredits: sumCredits(semesterCourses.filter((c) => c.isCompleted)),
    plannedCredits: sumCredits(
      semesterCourses.filter(
        (c) => c.status === "planned" || c.status === "placeholder",
      ),
    ),
  };
};

/**
 * Estimate completion semester based on credits and planned courses
 */
export const estimateCompletion = (required, earned, semesters) => {
  if (earned >= required) return "Completed";

  const remaining = required - earned;
  const avgCreditsPerSemester =
    semesters.length > 0
      ? semesters.reduce((sum, s) => sum + s.totalCredits, 0) / semesters.length
      : 30;

  const semestersNeeded = Math.ceil(
    remaining / Math.max(avgCreditsPerSemester, 15),
  );
  const futureSems = semesters.filter((s) => s.status === "future");

  if (futureSems.length >= semestersNeeded) {
    return futureSems[semestersNeeded - 1]?.key || "TBD";
  }

  const lastSemester = semesters[semesters.length - 1];
  if (!lastSemester) return "TBD";

  let projected = lastSemester.key;
  for (let i = 0; i < semestersNeeded - futureSems.length; i++) {
    projected = nextSemesterKey(projected);
  }
  return projected;
};

const coursesInSemester = (grid, semKey) =>
  Object.values(grid[semKey] || {}).flat();

/**
 * Apply processExerciseGroupECTS to each semester's courses and write the
 * adjusted credits back into the grid.
 */
export const normalizeExerciseGroupCredits = (grid, semesterKeys) => {
  semesterKeys.forEach((semKey) => {
    const allSemesterCourses = coursesInSemester(grid, semKey);

    if (allSemesterCourses.length === 0) return;

    const processedCourses = processExerciseGroupECTS(allSemesterCourses);

    const processedCreditsMap = new Map();
    processedCourses.forEach((course) => {
      const courseId = course.id || course.courseId;
      if (courseId) {
        processedCreditsMap.set(courseId, course.credits);
      }
    });

    Object.keys(grid[semKey]).forEach((catPath) => {
      grid[semKey][catPath] = grid[semKey][catPath].map((course) => {
        const courseId = course.id || course.courseId;
        if (courseId && processedCreditsMap.has(courseId)) {
          return { ...course, credits: processedCreditsMap.get(courseId) };
        }
        return course;
      });
    });
  });
};

export const computeSemesterStats = (grid, semesterKeys, semesterNotes) =>
  semesterKeys.map((semKey) => {
    const semesterCourses = coursesInSemester(grid, semKey);
    return {
      key: semKey,
      status: semesterStatus(semKey),
      ...computeSemesterCreditStats(semesterCourses),
      courseCount: semesterCourses.length,
      note: semesterNotes?.[semKey] || "",
    };
  });

/** Each leaf with its transcript credits plus everything placed in the grid. */
export const computeCategoryCredits = (flatCategories, grid, semesterKeys) =>
  flatCategories.map((cat) => {
    const earnedCredits = cat.earnedCredits || 0;
    let plannedCredits = 0;

    semesterKeys.forEach((semKey) => {
      const courses = grid[semKey]?.[cat.path] || [];
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
      isComplete: meetsRequirement({ ...cat, earnedCredits, plannedCredits }),
    };
  });

export const computeProgramStats = ({
  mainProgramId,
  rawScorecard,
  categoriesWithCredits,
  semesters,
}) => {
  const totalEarned = categoriesWithCredits.reduce(
    (sum, c) => sum + c.earnedCredits,
    0,
  );
  const totalPlanned = categoriesWithCredits.reduce(
    (sum, c) => sum + c.plannedCredits,
    0,
  );
  const totalRequired = parseFloat(rawScorecard?.items?.[0]?.maxCredits) || 180;

  return {
    id: mainProgramId,
    name: mainProgramId,
    totalRequired,
    totalEarned,
    totalPlanned,
    completionPercentage: Math.round((totalEarned / totalRequired) * 100),
    estimatedCompletion: estimateCompletion(
      totalRequired,
      totalEarned,
      semesters,
    ),
  };
};
