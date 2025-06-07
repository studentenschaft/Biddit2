import { useRecoilState } from "recoil";
import {
  unifiedCourseDataState,
  initializedSemestersState,
} from "../recoil/unifiedCourseDataAtom";

/**
 * Custom hook for managing unified course data
 * This replaces multiple hooks like useUpdateEnrolledCourses, useUpdateCourseInfo, etc.
 */
export function useUnifiedCourseData() {
  const [courseData, setCourseData] = useRecoilState(unifiedCourseDataState);
  const [initializedSemesters, setInitializedSemesters] = useRecoilState(
    initializedSemestersState
  );  /**
   * Initialize a semester with empty data structure
   */
  const initializeSemester = (semesterShortName) => {
    // Check both the initializedSemesters set AND if the semester data exists
    // This prevents race conditions during rapid state updates
    if (initializedSemesters.has(semesterShortName) || courseData[semesterShortName]) {
      console.log(`📋 Semester ${semesterShortName} already initialized or exists in state`);
      return; // Already initialized
    }

    console.log(`🚀 Initializing semester ${semesterShortName}`);
    setCourseData((prev) => {
      // Double-check inside the state updater to prevent race conditions
      if (prev[semesterShortName]) {
        console.log(`📋 Semester ${semesterShortName} was already initialized during state update`);
        return prev; // Already exists, don't reset it
      }
      
      const newData = {
        ...prev,
        [semesterShortName]: {
          enrolled: [],
          available: [],
          selected: [],
          ratings: {},
          lastFetched: null,
        },
      };
      console.log(`✅ Initialized semester ${semesterShortName}:`, newData[semesterShortName]);
      return newData;
    });

    setInitializedSemesters((prev) => new Set([...prev, semesterShortName]));
  };  /**
   * Update enrolled courses for a semester
   */
  const updateEnrolledCourses = (semesterShortName, courses) => {
    console.log(`🔄 updateEnrolledCourses called for ${semesterShortName} with ${courses.length} courses`);
    
    // Only initialize if semester doesn't exist
    if (!courseData[semesterShortName]) {
      initializeSemester(semesterShortName);
    }

    setCourseData((prev) => {
      const newData = {
        ...prev,
        [semesterShortName]: {
          ...prev[semesterShortName],
          enrolled: courses,
          lastFetched: new Date().toISOString(),
        },
      };
      console.log(`✅ Updated enrolled courses for ${semesterShortName}:`, newData[semesterShortName]);
      return newData;
    });
  };
  /**
   * Update available courses for a semester
   */
  const updateAvailableCourses = (semesterShortName, courses) => {
    console.log(`🔄 updateAvailableCourses called for ${semesterShortName} with ${courses.length} courses`);
    
    // Only initialize if semester doesn't exist
    if (!courseData[semesterShortName]) {
      initializeSemester(semesterShortName);
    }

    setCourseData((prev) => {
      const newData = {
        ...prev,
        [semesterShortName]: {
          ...prev[semesterShortName],
          available: courses,
          lastFetched: new Date().toISOString(),
        },
      };
      console.log(`✅ Updated available courses for ${semesterShortName}:`, newData[semesterShortName]);
      return newData;
    });
  };  /**
   * Update selected/wishlisted courses for a semester
   */
  const updateSelectedCourses = (semesterShortName, courses) => {
    console.log(`🔄 updateSelectedCourses called for ${semesterShortName} with ${courses.length} courses`);
    
    // Only initialize if semester doesn't exist
    if (!courseData[semesterShortName]) {
      initializeSemester(semesterShortName);
    }

    setCourseData((prev) => {
      const newData = {
        ...prev,
        [semesterShortName]: {
          ...prev[semesterShortName],
          selected: courses,
          lastFetched: new Date().toISOString(),
        },
      };
      console.log(`✅ Updated selected courses for ${semesterShortName}:`, newData[semesterShortName]);
      return newData;
    });
  };
  /**
   * Add a course to selected courses for a semester
   */
  const addSelectedCourse = (semesterShortName, course) => {
    // Only initialize if semester doesn't exist
    if (!courseData[semesterShortName]) {
      initializeSemester(semesterShortName);
    }

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
    // Only initialize if semester doesn't exist
    if (!courseData[semesterShortName]) {
      initializeSemester(semesterShortName);
    }

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
