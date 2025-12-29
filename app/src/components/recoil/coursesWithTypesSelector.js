import { selector } from "recoil";
import { unifiedAcademicDataState } from "./unifiedAcademicDataAtom";

const getCategoryTypeMap = (items) => {
  const categoryMap = new Map();

  const processNode = (node) => {
    if (node.isTitle) {
      let type = "core";

      // Determine type based on hierarchy and context
      if (node.hierarchy?.startsWith("00100")) {
        if (node.description?.includes("Elective")) {
          type = "elective";
        }
      } else if (node.hierarchy?.startsWith("00101")) {
        type = "contextual";
      }

      if (node.shortName) {
        categoryMap.set(node.shortName, type);
      }
    }

    // Process children
    node.items?.forEach(processNode);
  };

  items.forEach(processNode);
  return Object.fromEntries(categoryMap);
};

export const coursesWithTypesSelector = selector({
  key: "coursesWithTypesSelector",
  get: ({ get }) => {
    const academicData = get(unifiedAcademicDataState);

    if (!academicData.initialization?.isInitialized || !academicData.programs) {
      return {
        courses: [],
        categoryTypeMap: {},
      };
    }

    const categoryTypeMap = {};

    // Extract raw scorecards from unified academic data structure
    Object.values(academicData.programs).forEach((program) => {
      const rawScorecard = program.transcript?.rawScorecard;
      if (rawScorecard?.items) {
        const categoryMap = getCategoryTypeMap(rawScorecard.items);
        Object.entries(categoryMap).forEach(([key, value]) => {
          categoryTypeMap[key] = value;
        });
      }
    });

    console.log("categoryTypeMap:", categoryTypeMap);

    return categoryTypeMap;
  },
});
