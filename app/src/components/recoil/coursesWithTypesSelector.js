import { selector } from "recoil";
import { scorecardDataState } from "./scorecardsAllRawAtom";

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
    const scorecardData = get(scorecardDataState);

    if (!scorecardData.isLoaded || !scorecardData.rawScorecards) {
      return {
        courses: [],
        categoryTypeMap: {},
      };
    }

    const categoryTypeMap = {};

    Object.values(scorecardData.rawScorecards).forEach((scorecard) => {
      if (scorecard?.items) {
        const categoryMap = getCategoryTypeMap(scorecard.items);
        Object.entries(categoryMap).forEach(([key, value]) => {
          categoryTypeMap[key] = value;
        });
      }
    });

    console.log("categoryTypeMap:", categoryTypeMap);

    return categoryTypeMap;
  },
});
