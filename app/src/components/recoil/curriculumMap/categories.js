import categoryPatterns from "./categoryPatterns.json";

/**
 * Extract classification values that should map to a category.
 * Uses category name/description patterns to infer valid classifications.
 * Every matching pattern contributes its values, in table order.
 */
export const extractClassifications = (categoryItem) => {
  const name = (
    categoryItem.description ||
    categoryItem.shortName ||
    ""
  ).toLowerCase();
  const includesAny = (keywords = []) =>
    keywords.some((kw) => name.includes(kw));

  // `excludeKeywords` stops "elective"/"wahl" from matching "Wahlpflicht".
  return categoryPatterns
    .filter(
      ({ keywords, excludeKeywords }) =>
        includesAny(keywords) && !includesAny(excludeKeywords),
    )
    .flatMap(({ values }) => values);
};

/**
 * Recursively extract category structure from scorecard items
 */
export const extractCategoryHierarchy = (items, parentPath = "", level = 0) => {
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
        category.children = extractCategoryHierarchy(
          item.items,
          path,
          level + 1,
        );
      }

      categories.push(category);
    }
  });

  return categories;
};

/**
 * Extract courses (non-title items) with their semester and category info
 */
export const extractCoursesFromHierarchy = (
  items,
  categoryPath = "",
  parentHierarchy = "",
) => {
  const courses = [];

  (items || []).forEach((item) => {
    if (item.isTitle) {
      const subPath = categoryPath
        ? `${categoryPath}/${item.description || item.shortName}`
        : item.description || item.shortName;

      if (item.items) {
        courses.push(
          ...extractCoursesFromHierarchy(item.items, subPath, item.hierarchy),
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
export const getHierarchyDepth = (categories, currentDepth = 0) => {
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
export const flattenCategoriesForGrid = (categories) => {
  const flattened = [];

  const shouldSkipLevel0 =
    categories.length === 1 && categories[0].children.length > 0;

  const effectiveCategories = shouldSkipLevel0
    ? categories[0].children
    : categories;

  const recurse = (cats, depth, groupingParentId = null, ancestors = []) => {
    cats.forEach((cat) => {
      const parentIdForChildren = depth === 0 ? cat.id : groupingParentId;
      const isLeaf = !cat.children?.length;

      if (isLeaf) {
        flattened.push({
          ...cat,
          children: [],
          topLevelParentId: depth === 0 ? null : groupingParentId,
          // Grouping nodes are not grid rows, so a classification naming one
          // can only be resolved through the leaves that sit beneath it.
          ancestors,
        });
      } else {
        recurse(cat.children, depth + 1, parentIdForChildren, [
          ...ancestors,
          { id: cat.id, name: cat.name },
        ]);
      }
    });
  };

  recurse(effectiveCategories, 0, null, []);
  return flattened;
};

/** True when `classification` is covered by a category's keyword list. */
const matchesValidClassification = (category, lowerClassification) =>
  category.validClassifications.some(
    (vc) =>
      vc.toLowerCase() === lowerClassification ||
      lowerClassification.includes(vc.toLowerCase()),
  );

/**
 * Leaves sitting under a grouping (non-leaf) category of that name. Grid rows
 * are leaves only, so an ancestor name is otherwise unreachable.
 */
const findLeavesUnderAncestor = (lowerClassification, flatCategories) =>
  flatCategories.filter((cat) =>
    cat.ancestors.some((a) => a.name.toLowerCase() === lowerClassification),
  );

/** Best guess among several leaves of one ancestor, using the classification alone. */
const pickLeafUnderAncestor = (lowerClassification, candidates) =>
  candidates.find((cat) =>
    lowerClassification.includes(cat.name.toLowerCase()),
  ) ||
  candidates.find((cat) =>
    matchesValidClassification(cat, lowerClassification),
  ) ||
  candidates[0];

/**
 * Match a classification (or a course-name prefix) to a grid category.
 *
 * Order: exact leaf name → ancestor (grouping) name resolved to a leaf, its
 * only one or the best guess among several → keyword/substring match against a
 * leaf's validClassifications.
 *
 * @returns {object|undefined} The matched category, or undefined if no match
 */
export const matchClassificationToCategory = (
  classification,
  flatCategories,
) => {
  if (!classification) return undefined;
  const lowerClassification = classification.toLowerCase();
  const underAncestor = findLeavesUnderAncestor(
    lowerClassification,
    flatCategories,
  );

  return (
    flatCategories.find(
      (cat) => cat.name.toLowerCase() === lowerClassification,
    ) ||
    (underAncestor.length
      ? pickLeafUnderAncestor(lowerClassification, underAncestor)
      : undefined) ||
    flatCategories.find((cat) =>
      matchesValidClassification(cat, lowerClassification),
    )
  );
};

/** Course names carry their category as a prefix: "Skills: Julia - …". */
const MAX_PREFIX_WORDS = 3;

/**
 * Extract the category prefix from a course name, i.e. the text before the
 * first colon when it is short enough to be a category rather than a title.
 *
 * @returns {string|null} The prefix, or null when the name carries none
 */
export const inferClassificationFromCourseName = (name) => {
  if (!name) return null;
  const colonIndex = name.indexOf(":");
  if (colonIndex <= 0) return null;

  const prefix = name.slice(0, colonIndex).trim();
  if (!prefix) return null;

  return prefix.split(/\s+/).length <= MAX_PREFIX_WORDS ? prefix : null;
};

const FOCUS_AREA_KEYWORDS = [
  "focus",
  "schwerpunkt",
  "concentration",
  "area of concentration",
];

/**
 * Programs without a skills bucket file "Skills:" courses under their focus
 * area. (A skills bucket itself is already reachable by keyword.)
 */
const findFocusAreaLeaf = (flatCategories) =>
  flatCategories.find((cat) =>
    FOCUS_AREA_KEYWORDS.some(
      (kw) =>
        cat.name.toLowerCase().includes(kw) ||
        cat.validClassifications.some((vc) => vc.toLowerCase().includes(kw)),
    ),
  );

/** Resolve a course-name prefix against a set of leaves. */
const matchPrefix = (prefix, categories) =>
  matchClassificationToCategory(prefix, categories) ||
  (prefix.toLowerCase() === "skills"
    ? findFocusAreaLeaf(categories)
    : undefined);

/**
 * Resolve the grid category for a course: the classification first, the
 * category prefix carried by the course name second.
 *
 * The one wrinkle is an ambiguous ancestor: when the classification names a
 * grouping node with several leaves, the prefix breaks the tie — but only among
 * that node's leaves. The classification is what the university says about the
 * enrolment, so it always wins the group; the prefix reaches other branches only
 * when the classification matched nothing at all.
 *
 * @returns {object|undefined} The matched category, or undefined if no match
 */
export const resolveCategoryForCourse = ({
  classification,
  courseName,
  flatCategories = [],
}) => {
  const prefix = inferClassificationFromCourseName(courseName);
  const lowerClassification = (classification || "").toLowerCase();

  const isExactLeaf = flatCategories.some(
    (cat) => cat.name.toLowerCase() === lowerClassification,
  );
  const ambiguousAncestor =
    lowerClassification && !isExactLeaf
      ? findLeavesUnderAncestor(lowerClassification, flatCategories)
      : [];

  if (prefix && ambiguousAncestor.length > 1) {
    const tiebreak = matchPrefix(prefix, ambiguousAncestor);
    if (tiebreak) return tiebreak;
  }

  return (
    matchClassificationToCategory(classification, flatCategories) ||
    (prefix ? matchPrefix(prefix, flatCategories) : undefined)
  );
};

/**
 * Least-wrong bucket for a course we could not classify. An elective leaf does
 * not inflate compulsory progress, so it is preferred over the first column.
 *
 * @returns {object|undefined} The fallback category, or undefined if none
 */
export const resolveFallbackCategory = (flatCategories = []) =>
  flatCategories.find((cat) =>
    cat.validClassifications.some((vc) => vc.toLowerCase() === "elective"),
  ) || flatCategories[flatCategories.length - 1];

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
export const doesClassificationMatchCategory = (
  classification,
  categoryName,
  validClassifications,
) => {
  if (!classification || !validClassifications) return false;
  const lower = classification.toLowerCase();
  return (
    categoryName.toLowerCase() === lower ||
    validClassifications.some(
      (vc) => vc.toLowerCase() === lower || lower.includes(vc.toLowerCase()),
    )
  );
};
