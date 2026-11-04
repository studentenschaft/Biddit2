/**
 * transformScorecard.js
 * Transforms the raw scorecard data into a structured format suitable for rendering.
 * @param {Object} scorecard - The raw scorecard data fetched from the API.
 * @returns {Object} - An object where semesters are keys and values are arrays of course objects.
 */
import {
  compareSemesterKeys,
  nextSemesterKey,
  normalizeSemesterKey,
  parseSemesterKey,
  sortSemesterKeys,
} from "../../domain/semester";

/**
 * Parses a semester string into year and semester components
 * ({ year: 2025, sem: 1 } for FS25, sem 2 for HS); null when unparseable.
 */
export const parseSemester = (semesterStr) => {
  const parsed = parseSemesterKey(semesterStr);
  if (!parsed) return null;
  return { year: parsed.fullYear, sem: parsed.season === "FS" ? 1 : 2 };
};

/**
 * Fills in missing semesters between earliest and latest in the data, in
 * chronological order. Keys that are not semesters (e.g. "Unassigned") are dropped.
 */
export const fillMissingSemesters = (semesterData) => {
  const keys = sortSemesterKeys(
    Object.keys(semesterData).filter((key) => parseSemesterKey(key)),
  );
  if (keys.length === 0) return {};

  const last = keys[keys.length - 1];
  const filledSemesters = {};
  for (
    let key = keys[0];
    compareSemesterKeys(key, last) <= 0;
    key = nextSemesterKey(key)
  ) {
    filledSemesters[key] = semesterData[key] || [];
  }
  return filledSemesters;
};

export const transformScorecard = (scorecard) => {
  if (!scorecard || !scorecard.items || scorecard.items.length === 0) {
    return {};
  }

  const semesters = {};

  const processItems = (items) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      if (item.isDetail && !item.isTitle) {
        const semester = normalizeSemesterKey(item.semester) || "Unassigned";
        if (!semesters[semester]) {
          semesters[semester] = [];
        }
        semesters[semester].push({
          name: item.shortName || item.description || `Course ${item.id}`,
          credits: parseFloat(item.sumOfCredits) || 0,
          type: item.hierarchyParent.includes("00100")
            ? "core"
            : item.hierarchyParent.includes("00101")
            ? "contextual"
            : "elective",
          grade: item.mark ? parseFloat(item.mark) : null,
          gradeText: item.gradeText,
          id: item.id,
          courseId: item.id,
        });
      } else if (item.items) {
        processItems(item.items);
      }
    });
  };

  processItems(scorecard.items);

  // Sort each semester’s courses by type in a stable order
  const typeOrder = { core: 1, elective: 2, contextual: 3 };
  Object.values(semesters).forEach((courses) => {
    courses.sort(
      (a, b) => (typeOrder[a?.type] || 99) - (typeOrder[b?.type] || 99)
    );
  });

  return fillMissingSemesters(semesters);
};
