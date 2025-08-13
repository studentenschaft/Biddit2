/**
 * transformScorecard.js
 * Transforms the raw scorecard data into a structured format suitable for rendering.
 * @param {Object} scorecard - The raw scorecard data fetched from the API.
 * @returns {Object} - An object where semesters are keys and values are arrays of course objects.
 */

/**
 * Parses a semester string into year and semester components
 */
export const parseSemester = (() => {
    const cache = {};
    return (semesterStr) => {
      if (!semesterStr) return null;
      if (cache[semesterStr]) return cache[semesterStr];
  
      const cleanStr = removeSpacesFromSemesterName(semesterStr);
      const season = cleanStr.slice(0, 2);
      const shortYear = cleanStr.slice(2);
      const year = 2000 + parseInt(shortYear, 10);
      const sem = season === "FS" ? 1 : 2;
      const result = { year, sem };
      cache[semesterStr] = result;
      return result;
    };
  })();

/**
 * Formats year and semester components back into semester string
 */
export const formatSemester = ({ year, sem }) => {
  const season = sem === 1 ? "FS" : "HS";
  const yearShort = (year % 100).toString().padStart(2, "0");
  return `${season}${yearShort}`; // Removed space
};

const removeSpacesFromSemesterName = (semester) => {
  return semester ? semester.replace(/\s+/g, "") : "";
};

/**
 * Fills in missing semesters between earliest and latest in the data
 */
export const fillMissingSemesters = (semesterData) => {
  const allSemesterKeys = Object.keys(semesterData);
  if (allSemesterKeys.length === 0) return semesterData;

  const numericSemesters = allSemesterKeys.map((s) => {
    const parsed = parseSemester(s);
    return parsed ? (parsed.year % 100) * 10 + parsed.sem : null;
  }).filter(Boolean);

  const minSemester = Math.min(...numericSemesters);
  const maxSemester = Math.max(...numericSemesters);

  const filledSemesters = {};

  for (let i = minSemester; i <= maxSemester; i++) {
    // Skip invalid semester suffixes (e.g. 3, 4, etc.)
    if (i % 10 > 2) continue;

    const year = 2000 + Math.floor(i / 10);
    const sem = i % 10;
    const semesterStr = formatSemester({ year, sem });

    filledSemesters[semesterStr] = semesterData[semesterStr] || [];
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
        const semester = removeSpacesFromSemesterName(item.semester || "Unassigned");
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

  // Fill missing semesters
  const filledSemesters = fillMissingSemesters(semesters);

  // Sort the semesters by chronological order
  const sortedSemesters = Object.entries(filledSemesters)
    .sort((a, b) => {
      const parseA = parseSemester(a[0]);
      const parseB = parseSemester(b[0]);
      if (!parseA || !parseB) return 0;

      if (parseA.year !== parseB.year) {
        return parseA.year - parseB.year;
      }
      return parseA.sem - parseB.sem;
    })
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

  return sortedSemesters;
};