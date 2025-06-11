import { useRecoilState } from "recoil";
import { unifiedCourseDataState } from "../recoil/unifiedCourseDataAtom";

/**
 * Hook to manage unified semester state
 * Provides functions to update semester selection, future status, and reference semester
 */
export function useUnifiedSemesterState() {
  const [courseData, setCourseData] = useRecoilState(unifiedCourseDataState);

  /**
   * Update the selected semester and determine if it's a future semester
   */
  const setSelectedSemester = (
    semesterShortName,
    termIdList,
    latestValidTerm
  ) => {
    setCourseData((prev) => {
      const selectedTermIdx = termIdList?.findIndex(
        (term) => term.shortName === semesterShortName
      );
      const latestValidTermIdx = termIdList?.findIndex(
        (term) => term.shortName === latestValidTerm
      );

      const isFuture = selectedTermIdx > latestValidTermIdx;

      let referenceSemester = null;
      if (isFuture && termIdList?.length) {
        // Determine reference semester for future projections
        // Use the term with more course data or fallback to most recent
        referenceSemester = latestValidTerm || termIdList[0]?.shortName;
      }

      return {
        ...prev,
        selectedSemester: semesterShortName,
        isFutureSemester: isFuture,
        referenceSemester: isFuture ? referenceSemester : null,
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

  /**
   * Manually set future semester status and reference
   */
  const setFutureSemesterStatus = (isFuture, referenceSemester = null) => {
    setCourseData((prev) => ({
      ...prev,
      isFutureSemester: isFuture,
      referenceSemester: isFuture ? referenceSemester : null,
    }));
  };

  /**
   * Initialize a semester in the unified structure
   */
  const initializeSemester = (semesterShortName) => {
    setCourseData((prev) => {
      if (prev.semesters[semesterShortName]) {
        return prev; // Already initialized
      }

      return {
        ...prev,
        semesters: {
          ...prev.semesters,
          [semesterShortName]: {
            enrolled: [],
            available: [],
            selected: [],
            filtered: [],
            ratings: {},
            lastFetched: null,
          },
        },
      };
    });
  };

  /**
   * Update course data for a specific semester and type
   */
  const updateSemesterCourses = (semesterShortName, type, courses) => {
    setCourseData((prev) => ({
      ...prev,
      semesters: {
        ...prev.semesters,
        [semesterShortName]: {
          ...prev.semesters[semesterShortName],
          [type]: courses,
          lastFetched: new Date().toISOString(),
        },
      },
    }));
  };

  return {
    courseData,
    setSelectedSemester,
    setLatestValidTerm,
    setFutureSemesterStatus,
    initializeSemester,
    updateSemesterCourses,
  };
}
