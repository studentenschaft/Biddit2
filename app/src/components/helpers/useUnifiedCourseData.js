import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import {
  unifiedCourseDataState,
  initializedSemestersState,
} from "../recoil/unifiedCourseDataAtom";
import { semesterCourseDataSelector } from "../recoil/unifiedCourseDataSelectors";

/**
 * Custom hook for managing unified course data
 * This replaces multiple hooks like useUpdateEnrolledCourses, useUpdateCourseInfo, etc.
 */
export function useUnifiedCourseData() {
  const [courseData, setCourseData] = useRecoilState(unifiedCourseDataState);
  const [initializedSemesters, setInitializedSemesters] = useRecoilState(
    initializedSemestersState
  );

  /**
   * Initialize a semester with empty data structure
   */
  const initializeSemester = (semesterShortName) => {
    if (initializedSemesters.has(semesterShortName)) {
      return; // Already initialized
    }

    setCourseData((prev) => ({
      ...prev,
      [semesterShortName]: {
        enrolled: [],
        available: [],
        selected: [],
        ratings: {},
        lastFetched: null,
      },
    }));

    setInitializedSemesters((prev) => new Set([...prev, semesterShortName]));
  };

  /**
   * Update enrolled courses for a semester
   */
  const updateEnrolledCourses = (semesterShortName, courses) => {
    initializeSemester(semesterShortName);

    setCourseData((prev) => ({
      ...prev,
      [semesterShortName]: {
        ...prev[semesterShortName],
        enrolled: courses,
        lastFetched: new Date().toISOString(),
      },
    }));
  };

  /**
   * Update available courses for a semester
   */
  const updateAvailableCourses = (semesterShortName, courses) => {
    initializeSemester(semesterShortName);

    setCourseData((prev) => ({
      ...prev,
      [semesterShortName]: {
        ...prev[semesterShortName],
        available: courses,
        lastFetched: new Date().toISOString(),
      },
    }));
  };

  /**
   * Update selected/wishlisted courses for a semester
   */
  const updateSelectedCourses = (semesterShortName, courses) => {
    initializeSemester(semesterShortName);

    setCourseData((prev) => ({
      ...prev,
      [semesterShortName]: {
        ...prev[semesterShortName],
        selected: courses,
        lastFetched: new Date().toISOString(),
      },
    }));
  };

  /**
   * Add a course to selected courses for a semester
   */
  const addSelectedCourse = (semesterShortName, course) => {
    initializeSemester(semesterShortName);

    setCourseData((prev) => {
      const currentSelected = prev[semesterShortName]?.selected || [];

      // Check if course already exists
      const exists = currentSelected.some(
        (c) => c.id === course.id || c.courseNumber === course.courseNumber
      );

      if (exists) return prev;

      return {
        ...prev,
        [semesterShortName]: {
          ...prev[semesterShortName],
          selected: [...currentSelected, course],
        },
      };
    });
  };

  /**
   * Remove a course from selected courses for a semester
   */
  const removeSelectedCourse = (semesterShortName, courseId) => {
    setCourseData((prev) => {
      const currentSelected = prev[semesterShortName]?.selected || [];

      return {
        ...prev,
        [semesterShortName]: {
          ...prev[semesterShortName],
          selected: currentSelected.filter(
            (c) => c.id !== courseId && c.courseNumber !== courseId
          ),
        },
      };
    });
  };

  /**
   * Update course ratings for a semester
   */
  const updateCourseRatings = (semesterShortName, ratings) => {
    initializeSemester(semesterShortName);

    setCourseData((prev) => ({
      ...prev,
      [semesterShortName]: {
        ...prev[semesterShortName],
        ratings: { ...prev[semesterShortName]?.ratings, ...ratings },
      },
    }));
  };

  /**
   * Get data for a specific semester
   */
  const getSemesterData = (semesterShortName) => {
    return (
      courseData[semesterShortName] || {
        enrolled: [],
        available: [],
        selected: [],
        ratings: {},
        lastFetched: null,
      }
    );
  };

  /**
   * Check if a semester needs data refresh (based on lastFetched time)
   */
  const needsRefresh = (semesterShortName, maxAgeMinutes = 30) => {
    const semesterData = getSemesterData(semesterShortName);
    if (!semesterData.lastFetched) return true;

    const lastFetched = new Date(semesterData.lastFetched);
    const now = new Date();
    const ageMinutes = (now - lastFetched) / (1000 * 60);

    return ageMinutes > maxAgeMinutes;
  };
  return {
    courseData,
    initializedSemesters,
    initializeSemester,
    initializeSemesterData: initializeSemester, // Alias for consistency
    updateEnrolledCourses,
    updateEnrolledCoursesForSemester: updateEnrolledCourses, // Alias for consistency
    updateAvailableCourses,
    updateAvailableCoursesForSemester: updateAvailableCourses, // Alias for consistency
    updateSelectedCourses,
    updateSelectedCoursesForSemester: updateSelectedCourses, // Alias for consistency
    addSelectedCourse,
    removeSelectedCourse,
    updateCourseRatings,
    updateCourseRatingsForSemester: updateCourseRatings, // Alias for consistency
    getSemesterData,
    needsRefresh,
  };
}
