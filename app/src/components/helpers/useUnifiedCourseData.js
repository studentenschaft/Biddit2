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
  );
  /**
   * Initialize a semester with empty data structure
   */
  const initializeSemester = (semesterShortName) => {
    // Check both the initializedSemesters set AND if the semester data exists
    // This prevents race conditions during rapid state updates
    if (
      initializedSemesters.has(semesterShortName) ||
      (courseData.semesters && courseData.semesters[semesterShortName])
    ) {
      return; // Already initialized
    }

    console.log(`🚀 Initializing semester ${semesterShortName}`);
    setCourseData((prev) => {
      // Double-check inside the state updater to prevent race conditions
      if (prev.semesters && prev.semesters[semesterShortName]) {
        return prev; // Already exists, don't reset it
      }

      // Create a clean copy that only includes the properties we want
      const cleanPrev = {
        semesters: prev.semesters || {},
        selectedSemester: prev.selectedSemester,
        latestValidTerm: prev.latestValidTerm,
      };

      const newData = {
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
      console.log(
        `✅ Initialized semester ${semesterShortName}:`,
        newData.semesters[semesterShortName]
      );
      return newData;
    });

    setInitializedSemesters((prev) => new Set([...prev, semesterShortName]));
  };
  /**
   * Update enrolled courses for a semester
   */
  const updateEnrolledCourses = (semesterShortName, courses) => {

    // Only initialize if semester doesn't exist
    if (!courseData.semesters || !courseData.semesters[semesterShortName]) {
      initializeSemester(semesterShortName);
    }

    setCourseData((prev) => {
      // Create a clean copy that only includes the properties we want
      const cleanPrev = {
        semesters: prev.semesters || {},
        selectedSemester: prev.selectedSemester,
        latestValidTerm: prev.latestValidTerm,
      };

      // Ensure the semester exists in the structure
      const existingSemester = (cleanPrev.semesters &&
        cleanPrev.semesters[semesterShortName]) || {
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

      const newData = {
        ...cleanPrev,
        semesters: {
          ...cleanPrev.semesters,
          [semesterShortName]: {
            ...existingSemester,
            enrolled: courses,
            lastFetched: new Date().toISOString(),
          },
        },
      };

      console.log(
        `✅ Updated enrolled courses for ${semesterShortName}:`,
        newData.semesters[semesterShortName]
      );
      return newData;
    });
  };
  /**
   * Update available courses for a semester
   */
  const updateAvailableCourses = (semesterShortName, courses) => {

    // Only initialize if semester doesn't exist
    if (!courseData.semesters || !courseData.semesters[semesterShortName]) {
      initializeSemester(semesterShortName);
    }

    setCourseData((prev) => {
      // Create a clean copy that only includes the properties we want
      const cleanPrev = {
        semesters: prev.semesters || {},
        selectedSemester: prev.selectedSemester,
        latestValidTerm: prev.latestValidTerm,
      };

      // Ensure the semester exists in the structure
      const existingSemester = (cleanPrev.semesters &&
        cleanPrev.semesters[semesterShortName]) || {
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

      const newData = {
        ...cleanPrev,
        semesters: {
          ...cleanPrev.semesters,
          [semesterShortName]: {
            ...existingSemester,
            available: courses,
            lastFetched: new Date().toISOString(),
          },
        },
      };
      console.log(
        `✅ Updated available courses for ${semesterShortName}:`,
        newData.semesters[semesterShortName]
      );
      return newData;
    });
  };
  /**
   * Update selected/wishlisted courses for a semester
   */
  const updateSelectedCourses = (semesterShortName, courses) => {

    // Only initialize if semester doesn't exist
    if (!courseData.semesters || !courseData.semesters[semesterShortName]) {
      initializeSemester(semesterShortName);
    }

    setCourseData((prev) => {
      // Create a clean copy that only includes the properties we want
      const cleanPrev = {
        semesters: prev.semesters || {},
        selectedSemester: prev.selectedSemester,
        latestValidTerm: prev.latestValidTerm,
      };

      // Ensure the semester exists in the structure
      const existingSemester = (cleanPrev.semesters &&
        cleanPrev.semesters[semesterShortName]) || {
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

      const newData = {
        ...cleanPrev,
        semesters: {
          ...cleanPrev.semesters,
          [semesterShortName]: {
            ...existingSemester,
            selected: courses,
            lastFetched: new Date().toISOString(),
          },
        },
      };
      console.log(
        `✅ Updated selected courses for ${semesterShortName}:`,
        newData.semesters[semesterShortName]
      );
      return newData;
    });
  };
  /**
   * Add a course to selected courses for a semester
   */
  const addSelectedCourse = (semesterShortName, course) => {
    // Only initialize if semester doesn't exist
    if (!courseData.semesters || !courseData.semesters[semesterShortName]) {
      initializeSemester(semesterShortName);
    }

    setCourseData((prev) => {
      // Create a clean copy that only includes the properties we want
      const cleanPrev = {
        semesters: prev.semesters || {},
        selectedSemester: prev.selectedSemester,
        latestValidTerm: prev.latestValidTerm,
      };

      const currentSelected =
        cleanPrev.semesters[semesterShortName]?.selected || [];

      // Check if course already exists
      const exists = currentSelected.some(
        (c) => c.id === course.id || c.courseNumber === course.courseNumber
      );

      if (exists) return prev;

      // Ensure the semester exists in the structure
      const existingSemester = cleanPrev.semesters[semesterShortName] || {
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

      return {
        ...cleanPrev,
        semesters: {
          ...cleanPrev.semesters,
          [semesterShortName]: {
            ...existingSemester,
            selected: [...currentSelected, course],
          },
        },
      };
    });
  };

  /**
   * Remove a course from selected courses for a semester
   */
  const removeSelectedCourse = (semesterShortName, courseId) => {
    setCourseData((prev) => {
      // Create a clean copy that only includes the properties we want
      const cleanPrev = {
        semesters: prev.semesters || {},
        selectedSemester: prev.selectedSemester,
        latestValidTerm: prev.latestValidTerm,
      };

      const currentSelected =
        cleanPrev.semesters[semesterShortName]?.selected || [];

      // Ensure the semester exists in the structure
      const existingSemester = cleanPrev.semesters[semesterShortName] || {
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

      return {
        ...cleanPrev,
        semesters: {
          ...cleanPrev.semesters,
          [semesterShortName]: {
            ...existingSemester,
            selected: currentSelected.filter(
              (c) => c.id !== courseId && c.courseNumber !== courseId
            ),
          },
        },
      };
    });
  };
  /**
   * Update course ratings for a semester
   */
  const updateCourseRatings = (semesterShortName, ratings) => {
    // Only initialize if semester doesn't exist
    if (!courseData.semesters || !courseData.semesters[semesterShortName]) {
      initializeSemester(semesterShortName);
    }

    // Process ratings into a consistent map format
    let ratingsMap = {};
    if (Array.isArray(ratings)) {
      // If ratings is an array, convert to object map
      ratings.forEach((rating) => {
        if (rating._id && rating.avgRating) {
          ratingsMap[rating._id] = rating.avgRating;
        }
      });
    } else if (typeof ratings === "object" && ratings !== null) {
      // If ratings is already an object, use it directly
      ratingsMap = ratings;
    }

    setCourseData((prev) => {
      // Create a clean copy that only includes the properties we want
      const cleanPrev = {
        semesters: prev.semesters || {},
        selectedSemester: prev.selectedSemester,
        latestValidTerm: prev.latestValidTerm,
      };

      // Ensure the semester exists in the structure
      const existingSemester = cleanPrev.semesters[semesterShortName] || {
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

      return {
        ...cleanPrev,
        semesters: {
          ...cleanPrev.semesters,
          [semesterShortName]: {
            ...existingSemester,
            // Replace existing ratings completely to avoid duplicates
            ratings: ratingsMap,
          },
        },
      };
    });
  };
  /**
   * Update course ratings for ALL semesters at once
   * Since ratings are global data that applies to all semesters
   */
  const updateCourseRatingsForAllSemesters = (ratings) => {

    // Process ratings into a consistent map format
    let ratingsMap = {};
    if (Array.isArray(ratings)) {
      // If ratings is an array, convert to object map
      ratings.forEach((rating) => {
        if (rating._id && rating.avgRating) {
          ratingsMap[rating._id] = rating.avgRating;
        }
      });
    } else if (typeof ratings === "object" && ratings !== null) {
      // If ratings is already an object, use it directly
      ratingsMap = ratings;
    }

    setCourseData((prev) => {
      // Create a clean copy that only includes the properties we want
      const cleanPrev = {
        semesters: prev.semesters || {},
        selectedSemester: prev.selectedSemester,
        latestValidTerm: prev.latestValidTerm,
      };

      const updatedSemesters = { ...cleanPrev.semesters };

      // Update ratings for all existing semesters
      Object.keys(updatedSemesters).forEach((semesterShortName) => {
        updatedSemesters[semesterShortName] = {
          ...updatedSemesters[semesterShortName],
          // Replace existing ratings completely to avoid duplicates
          ratings: ratingsMap,
        };
      });

      console.log(
        `✅ Updated ratings for ${
          Object.keys(updatedSemesters).length
        } semesters`
      );
      return {
        ...cleanPrev,
        semesters: updatedSemesters,
      };
    });
  };

  /**
   * Update filtered courses for a semester based on filter criteria
   * This applies the same filtering logic as filteredCoursesSelector but stores results in unified state
   */
  const updateFilteredCourses = (
    semesterShortName,
    filterOptions = {},
    selectedCourseIds = []
  ) => {

    // Only initialize if semester doesn't exist
    if (!courseData.semesters || !courseData.semesters[semesterShortName]) {
      initializeSemester(semesterShortName);
    }

    setCourseData((prev) => {
      // Create a clean copy that only includes the properties we want
      const cleanPrev = {
        semesters: prev.semesters || {},
        selectedSemester: prev.selectedSemester,
        latestValidTerm: prev.latestValidTerm,
      };

      const semesterData = cleanPrev.semesters[semesterShortName];
      if (!semesterData) return cleanPrev;

      // Get available courses to filter
      const coursesToFilter = semesterData.available || [];

      if (coursesToFilter.length === 0) {
        return {
          ...cleanPrev,
          semesters: {
            ...cleanPrev.semesters,
            [semesterShortName]: {
              ...semesterData,
              filtered: [],
            },
          },
        };
      }

      // Apply filter criteria
      const filtered = coursesToFilter.filter((course) => {
        return applyFilterCriteria(course, filterOptions);
      });

      // Sort and mark selected courses
      const sortedFiltered = sortAndMarkSelectedCourses(
        filtered,
        selectedCourseIds
      );

      const newData = {
        ...cleanPrev,
        semesters: {
          ...cleanPrev.semesters,
          [semesterShortName]: {
            ...semesterData,
            filtered: sortedFiltered,
          },
        },
      };

      console.log(
        `✅ Updated filtered courses for ${semesterShortName}: ${sortedFiltered.length} courses`
      );

      return newData;
    });
  };

  /**
   * Helper function to apply filter criteria (same as in filteredCoursesSelector)
   */
  const applyFilterCriteria = (course, selectionOptions) => {
    const classifications = selectionOptions.classifications || [];
    const ects = selectionOptions.ects || [];
    const ratings = selectionOptions.ratings || [];
    const courseLanguage = selectionOptions.courseLanguage || [];
    const lecturer = selectionOptions.lecturer || [];
    const searchTerm = selectionOptions.searchTerm || "";

    if (
      classifications.length > 0 &&
      !classifications.includes(course.classification)
    ) {
      return false;
    }

    if (ects.length > 0 && !ects.includes(course.credits)) {
      return false;
    }

    if (
      lecturer.length > 0 &&
      course.courses &&
      course.courses[0] &&
      course.courses[0].lecturers &&
      !course.courses[0].lecturers.some((lect) =>
        lecturer.includes(lect.displayName)
      )
    ) {
      return false;
    }

    if (ratings.length > 0 && course.avgRating < Math.max(...ratings)) {
      return false;
    }

    if (
      courseLanguage.length > 0 &&
      !courseLanguage.includes(course.courseLanguage?.code)
    ) {
      return false;
    }

    if (
      searchTerm.length > 0 &&
      !course.shortName.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }

    return true;
  };

  /**
   * Helper function to sort and mark selected courses (same as in filteredCoursesSelector)
   */
  const sortAndMarkSelectedCourses = (courses, selectedCourseIds) => {
    return courses.sort((a, b) => {
      const aSelected =
        selectedCourseIds.includes(a.id) ||
        selectedCourseIds.includes(a.courseNumber);
      const bSelected =
        selectedCourseIds.includes(b.id) ||
        selectedCourseIds.includes(b.courseNumber);

      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0;
    });
  };

  /**
   * Update filtered courses for ALL semesters at once
   * Useful when filter criteria changes globally
   */
  const updateFilteredCoursesForAllSemesters = (
    filterOptions = {},
    selectedCourseIds = []
  ) => {
    setCourseData((prev) => {
      // Create a clean copy that only includes the properties we want
      const cleanPrev = {
        semesters: prev.semesters || {},
        selectedSemester: prev.selectedSemester,
        latestValidTerm: prev.latestValidTerm,
      };

      const updatedSemesters = { ...cleanPrev.semesters };

      // Update filtered courses for all existing semesters
      Object.keys(updatedSemesters).forEach((semesterShortName) => {
        const semesterData = updatedSemesters[semesterShortName];
        const coursesToFilter = semesterData.available || [];

        if (coursesToFilter.length > 0) {
          // Apply filter criteria
          const filtered = coursesToFilter.filter((course) => {
            return applyFilterCriteria(course, filterOptions);
          });

          // Sort and mark selected courses
          const sortedFiltered = sortAndMarkSelectedCourses(
            filtered,
            selectedCourseIds
          );

          updatedSemesters[semesterShortName] = {
            ...semesterData,
            filtered: sortedFiltered,
          };
        } else {
          updatedSemesters[semesterShortName] = {
            ...semesterData,
            filtered: [],
          };
        }
      });

      console.log(
        `✅ Updated filtered courses for ${
          Object.keys(updatedSemesters).length
        } semesters`
      );
      return {
        ...cleanPrev,
        semesters: updatedSemesters,
      };
    });
  };
  /**
   * Get data for a specific semester
   */
  const getSemesterData = (semesterShortName) => {
    return (
      (courseData.semesters && courseData.semesters[semesterShortName]) || {
        enrolled: [],
        available: [],
        selected: [],
        filtered: [],
        ratings: {},
        lastFetched: null,
        isFutureSemester: false,
        referenceSemester: null,
        cisId: null,
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
    updateCourseRatingsForAllSemesters, // New function for global ratings
    updateFilteredCourses, // New function for filtered courses
    updateFilteredCoursesForSemester: updateFilteredCourses, // Alias for consistency
    updateFilteredCoursesForAllSemesters, // New function for global filtered courses
    getSemesterData,
    needsRefresh,
  };
}
