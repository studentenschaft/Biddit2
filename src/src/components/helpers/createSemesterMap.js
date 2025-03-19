/**
 * createSemesterMap.js
 *
 * Creates a mapping between CIS IDs and semester names
 * Handles both real CIS IDs and placeholder semester names
 */
export const createSemesterMap = (
  cisIdList = [],
  studyPlanItems = []
) => {
  const map = {};

  // Filter out projected terms and map real CIS IDs
  cisIdList
    .filter((term) => !term.isProjected)
    .forEach((term) => {
      if (term.cisId && term.shortName) {
        map[term.cisId] = term.shortName;
      }
    });

  // Map placeholder IDs from study plan
  studyPlanItems.forEach((plan) => {
    if (plan.id.includes("HS") || plan.id.includes("FS")) {
      map[plan.id] = plan.id.split(" - ")[0].replace(/\s/g, "");
    } else if (!map[plan.id]) {
      // Optionally set a fallback
      // map[plan.id] = 'ERROR'; 
    }
  });

  return map;
};