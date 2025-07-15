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
        // Determine reference semester for future projections
        // Use the term with more course data or fallback to most recent
        referenceSemesterName = latestValidTerm || termIdList[0]?.shortName;
      }

      // Ensure the semester exists in the data structure
      const semesterData = prev.semesters[semesterShortName] || {
        enrolled: [],
        available: [],
        selected: [],
        filtered: [],
        ratings: {},
        lastFetched: null,
        isFutureSemester: false,
        referenceSemester: null,
        cisId: null,
      };

      // Create a clean copy that only includes the properties we want
      const cleanPrev = {
        semesters: prev.semesters,
        selectedSemester: prev.selectedSemester,
        latestValidTerm: prev.latestValidTerm,
      };

      return {
        ...cleanPrev,
        selectedSemester: semesterShortName,
        semesters: {
          ...cleanPrev.semesters,
          [semesterShortName]: {
            ...semesterData,
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
    setCourseData((prev) => {
      // Create a clean copy that only includes the properties we want
      const cleanPrev = {
        semesters: prev.semesters,
        selectedSemester: prev.selectedSemester,
        latestValidTerm: prev.latestValidTerm,
      };

      return {
        ...cleanPrev,
        latestValidTerm: termShortName,
      };
    });
  };

  /**
   * Manually set future semester status and reference for the currently selected semester
   */
  const setFutureSemesterStatus = (isFuture, referenceSemester = null) => {
    setCourseData((prev) => {
      const selectedSem = prev.selectedSemester;
      if (!selectedSem) return prev;

      // Ensure the semester exists in the data structure
      const semesterData = prev.semesters[selectedSem] || {
        enrolled: [],
        available: [],
        selected: [],
        filtered: [],
        ratings: {},
        lastFetched: null,
        isFutureSemester: false,
        referenceSemester: null,
        cisId: null,
      };

      // Create a clean copy that only includes the properties we want
      const cleanPrev = {
        semesters: prev.semesters,
        selectedSemester: prev.selectedSemester,
        latestValidTerm: prev.latestValidTerm,
      };

      return {
        ...cleanPrev,
        semesters: {
          ...cleanPrev.semesters,
          [selectedSem]: {
            ...semesterData,
            isFutureSemester: isFuture,
            referenceSemester: isFuture ? referenceSemester : null,
          },
        },
      };
    });
  };

  /**
   * Initialize a semester in the unified structure
   */
  const initializeSemester = (semesterShortName) => {
    setCourseData((prev) => {
      if (prev.semesters[semesterShortName]) {
        return prev; // Already initialized
      }

      // Create a clean copy that only includes the properties we want
      const cleanPrev = {
        semesters: prev.semesters,
        selectedSemester: prev.selectedSemester,
        latestValidTerm: prev.latestValidTerm,
      };

      return {
        ...cleanPrev,
        semesters: {
          ...cleanPrev.semesters,
          [semesterShortName]: {
            enrolled: [],
            available: [],
            selected: [],
            filtered: [],
            ratings: {},
            lastFetched: null,
            isFutureSemester: false,
            referenceSemester: null,
            cisId: null,
          },
        },
      };
    });
  };

  /**
   * Update course data for a specific semester and type
   */
  const updateSemesterCourses = (semesterShortName, type, courses) => {
    setCourseData((prev) => {
      // Make sure the semester exists
      const existingSemester = prev.semesters[semesterShortName] || {
        enrolled: [],
        available: [],
        selected: [],
        filtered: [],
        ratings: {},
        lastFetched: null,
        isFutureSemester: false,
        referenceSemester: null,
        cisId: null,
      };

      // Create a clean copy that only includes the properties we want
      const cleanPrev = {
        semesters: prev.semesters,
        selectedSemester: prev.selectedSemester,
        latestValidTerm: prev.latestValidTerm,
      };

      return {
        ...cleanPrev,
        semesters: {
          ...cleanPrev.semesters,
          [semesterShortName]: {
            ...existingSemester,
            [type]: courses,
            lastFetched: new Date().toISOString(),
          },
        },
      };
    });
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
