import { useRecoilState } from "recoil";
import { unifiedCourseDataState } from "../recoil/unifiedCourseDataAtom";

/**
 * Hook to manage unified semester state
 * Provides functions to update semester selection, future status, reference semester and latest valid term
 */
export function useUnifiedSemesterState() {
  const [courseData, setCourseData] = useRecoilState(unifiedCourseDataState);

  // Compute same-season previous-year semester shortName (FS26 -> FS25, HS26 -> HS25)
  const computeSameSeasonPrevYear = (shortName) => {
    if (!shortName || shortName.length < 4) return null;
    const season = shortName.slice(0, 2); // FS / HS
    const yearPart = shortName.slice(2);
    const yearNum = parseInt(yearPart, 10);
    if (isNaN(yearNum)) return null;
    const prevYear = yearNum - 1;
    return `${season}${prevYear.toString().padStart(2, "0")}`;
  };

  /**
   * Update the selected semester and determine if it's a future semester
   */
  const setSelectedSemester = (
    semesterShortName,
    termIdList,
    latestValidTerm
  ) => {
    setCourseData((prev) => {
      // Safety checks for termIdList
      if (
        !termIdList ||
        !Array.isArray(termIdList) ||
        termIdList.length === 0
      ) {
        console.warn("[UnifiedSemesterState] Invalid termIdList provided");
        return {
          ...prev,
          selectedSemester: semesterShortName,
        };
      }

      const selectedTermIdx = termIdList.findIndex(
        (term) => term && term.shortName === semesterShortName
      );
      const latestValidTermIdx = termIdList.findIndex(
        (term) => term && term.shortName === latestValidTerm
      );

      // Handle the case where the terms aren't found in the list
      const isFuture =
        selectedTermIdx > -1 && latestValidTermIdx > -1
          ? selectedTermIdx > latestValidTermIdx
          : false;

      let referenceSemesterName = null;
      if (isFuture && termIdList?.length) {
        // SAME-SEASON PREVIOUS-YEAR RULE
        const candidate = computeSameSeasonPrevYear(semesterShortName);
        const existsInList = termIdList.some(
          (t) => t && t.shortName === candidate
        );
        referenceSemesterName = existsInList
          ? candidate
          : latestValidTerm || termIdList[0]?.shortName;
      }

      const prevSemesters = prev.semesters || {};
      const semesterData = prevSemesters[semesterShortName] || {};

      return {
        ...prev,
        selectedSemester: semesterShortName,
        semesters: {
          ...prevSemesters,
          [semesterShortName]: {
            ...semesterData,
            enrolledIds: semesterData.enrolledIds || [],
            available: semesterData.available || [],
            selectedIds: semesterData.selectedIds || [],
            filtered: semesterData.filtered || [],
            ratings: semesterData.ratings || {},
            lastFetched: semesterData.lastFetched || null,
            cisId: semesterData.cisId || null,
            isFutureSemester: isFuture,
            referenceSemester: isFuture ? referenceSemesterName : null,
          },
        },
      };
    });
  };

  /**
   * Set the latest valid term (term with actual course data)
   */
  const setLatestValidTerm = (termShortName) => {
    setCourseData((prev) => ({
      ...prev,
      latestValidTerm: termShortName,
    }));
  };

  return {
    courseData,
    setSelectedSemester,
    setLatestValidTerm,
  };
}
