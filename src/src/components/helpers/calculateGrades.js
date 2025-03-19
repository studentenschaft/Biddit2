// calculateGrades.js

/**
 * Core grade calculation utilities for the application
 */

/**
 * Calculates weighted average grade excluding specific course types
 * @param {Array} courses - Array of course objects with grades and credits
 * @returns {number|null} - Weighted average grade or null if no grades available
 */
export const calculateCreditsAndGrades = (items, getCustomGrade = null) => {
  const processItem = (item) => {
    
    // Determine if the item is a thesis category using the description.
    const descriptionLower = (item.description || "").toLowerCase();
    const isThesisCategory =
      descriptionLower.includes("thesis") &&
      descriptionLower.includes("(title in original language)");

    // If the item represents a category (title) then process its children.
    if (item.isTitle) {
      // Get the child items.
      let children = item.items;
      // If it's a thesis category with no children, insert a placeholder item.
      if (isThesisCategory && (!children || children.length === 0)) {
        children = [
          {
            isTitle: false,
            isPlaceholder: true,
            sumOfCredits: item.maxCredits || "0.00",
            mark: null,
            shortName: "Thesis placeholder",
            description: "Thesis placeholder",
          },
        ];
      }
      // If there are children (or we just created the placeholder), reduce them.
      if (children && children.length > 0) {
        return children.reduce(
          (acc, subItem) => {
            const result = processItem(subItem);
            return {
              totalCredits: acc.totalCredits + result.totalCredits,
              gradeSum: acc.gradeSum + result.gradeSum,
              filteredCredits: acc.filteredCredits + result.filteredCredits,
              customGradeSum: acc.customGradeSum + result.customGradeSum,
              customEctsSum: acc.customEctsSum + result.customEctsSum,
            };
          },
          { totalCredits: 0, gradeSum: 0, filteredCredits: 0, customGradeSum: 0, customEctsSum: 0 }
        );
      }
      // If no children are present, return zeros.
      return { totalCredits: 0, gradeSum: 0, filteredCredits: 0, customGradeSum: 0, customEctsSum: 0 };
    }

    // For non-title items, calculate using credits and grade values.
    const credits = parseFloat(item.sumOfCredits || item.credits) || 0;
    const mark = parseFloat(item.mark || item.grade);
    const isCampusCredits = item.description === "Campus Credits";
    const isPracticeCredits = item.description === "Practice Credits";

    // Get custom grade if available.
    const customGrade = getCustomGrade ? getCustomGrade(item.shortName) : null;
    // Use custom grade if available; otherwise use the actual mark.
    const gradeForCustomCalc = customGrade !== null ? customGrade : mark;

    return {
      totalCredits: credits,
      gradeSum:
        (!isNaN(mark) && !isCampusCredits && !isPracticeCredits) ? mark * credits : 0,
      filteredCredits:
        (!isNaN(mark) && !isCampusCredits && !isPracticeCredits) ? credits : 0,
      customGradeSum:
        (!isNaN(gradeForCustomCalc) && !isCampusCredits && !isPracticeCredits)
          ? gradeForCustomCalc * credits
          : 0,
      customEctsSum:
        (!isNaN(gradeForCustomCalc) && !isCampusCredits && !isPracticeCredits)
          ? credits
          : 0,
    };
  };

  // Process all top-level items.
  return items.reduce((acc, item) => {
    const result = processItem(item);
    return {
      totalCredits: acc.totalCredits + result.totalCredits,
      gradeSum: acc.gradeSum + result.gradeSum,
      filteredCredits: acc.filteredCredits + result.filteredCredits,
      customGradeSum: acc.customGradeSum + result.customGradeSum,
      customEctsSum: acc.customEctsSum + result.customEctsSum,
    };
  }, { totalCredits: 0, gradeSum: 0, filteredCredits: 0, customGradeSum: 0, customEctsSum: 0 });
};

/**
* Calculates semester credits
* @param {Array} courses - Array of courses
* @returns {number} Total credits for semester
*/
export const calculateSemesterCredits = (courses) => {
  return courses.reduce((sum, course) => {
      const credits = parseFloat(course.credits || course.sumOfCredits) || 0;
      return sum + credits;
  }, 0);
};