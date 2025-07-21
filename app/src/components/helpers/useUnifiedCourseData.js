import { useRecoilState } from "recoil";
import {
  unifiedCourseDataState,
  initializedSemestersState,
} from "../recoil/unifiedCourseDataAtom";

/**
 * Default semester structure with all required fields
 * This ensures consistency across the entire application
 */
const DEFAULT_SEMESTER_STRUCTURE = {
  enrolled: [],
  available: [],
  selected: [],
  filtered: [],
  ratings: {},
  lastFetched: null,
  isFutureSemester: false,
  referenceSemester: null,
  cisId: null,
  isCurrent: false,
  isProjected: false,
};

/**
 * Helper function to create a new semester with proper defaults
 */
const createSemesterStructure = (metadata = {}) => ({
  ...DEFAULT_SEMESTER_STRUCTURE,
  isFutureSemester: metadata.isFutureSemester || false,
  referenceSemester: metadata.referenceSemester || null,
  cisId: metadata.cisId || null,
  isCurrent: metadata.isCurrent || false,
  isProjected: metadata.isProjected || false,
});

/**
 * Custom hook for managing unified course data
 * This replaces multiple hooks like useUpdateEnrolledCourses, useUpdateCourseInfo, etc.
 *
 * SIMPLIFIED VERSION: Removes legacy atom dependencies and focuses only on unified data
 */
export function useUnifiedCourseData() {
  const [courseData, setCourseData] = useRecoilState(unifiedCourseDataState);
  const [initializedSemesters, setInitializedSemesters] = useRecoilState(
    initializedSemestersState
  );

  /**
   * Initialize a semester with empty data structure
   */
  const initializeSemester = (semesterShortName, metadata = {}) => {
    // Check both the initializedSemesters set AND if the semester data exists
    // This prevents race conditions during rapid state updates
    if (
      initializedSemesters.has(semesterShortName) ||
      (courseData.semesters && courseData.semesters[semesterShortName])
    ) {
      return; // Already initialized
    }

    console.log(`🚀 Initializing semester ${semesterShortName}`, metadata);
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
          [semesterShortName]: createSemesterStructure(metadata),
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
      const existingSemester =
        cleanPrev.semesters[semesterShortName] || DEFAULT_SEMESTER_STRUCTURE;

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
      const existingSemester =
        cleanPrev.semesters[semesterShortName] || DEFAULT_SEMESTER_STRUCTURE;

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
      const existingSemester =
        cleanPrev.semesters[semesterShortName] || DEFAULT_SEMESTER_STRUCTURE;

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
        (c) =>
          c.id === course.id ||
          c.courseNumber === course.courseNumber ||
          c.courses?.[0]?.courseNumber === course.courseNumber ||
          c.courses?.[0]?.courseNumber === course.courses?.[0]?.courseNumber
      );

      if (exists) return prev;

      // Ensure the semester exists in the structure
      const existingSemester =
        cleanPrev.semesters[semesterShortName] || DEFAULT_SEMESTER_STRUCTURE;

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
      const existingSemester =
        cleanPrev.semesters[semesterShortName] || DEFAULT_SEMESTER_STRUCTURE;

      return {
        ...cleanPrev,
        semesters: {
          ...cleanPrev.semesters,
          [semesterShortName]: {
            ...existingSemester,
            selected: currentSelected.filter(
              (c) =>
                c.id !== courseId &&
                c.courseNumber !== courseId &&
                c.courses?.[0]?.courseNumber !== courseId
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
      const existingSemester =
        cleanPrev.semesters[semesterShortName] || DEFAULT_SEMESTER_STRUCTURE;

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
        console.log(
          `⚠️ No available courses to filter for ${semesterShortName}`
        );
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

      console.log(
        `🔍 [DEBUG] Filtering ${coursesToFilter.length} available courses for ${semesterShortName} with options:`,
        filterOptions
      );

      // Apply filter criteria
      const filtered = coursesToFilter.filter((course) => {
        return applyFilterCriteria(course, filterOptions);
      });

      // Attach ratings and status FIRST, then sort
      const ratingsMap = semesterData.ratings || {};
      const enrolledCourses = semesterData.enrolled || [];
      const selectedCourses = semesterData.selected || [];

      console.log(`🔍 [DEBUG] Processing ${filtered.length} available courses`);
      console.log(`🔍 [DEBUG] Enrolled courses: ${enrolledCourses.length}`);
      console.log(`🔍 [DEBUG] Selected courses: ${selectedCourses.length}`);
      console.log(
        `🔍 [DEBUG] SelectedCourseIds: ${selectedCourseIds.length}`,
        selectedCourseIds.slice(0, 5)
      );

      // Log sample enrolled courses to see structure
      if (enrolledCourses.length > 0) {
        console.log(`🔍 [DEBUG] Sample enrolled course:`, enrolledCourses[0]);
      }
      if (selectedCourses.length > 0) {
        console.log(`🔍 [DEBUG] Sample selected course:`, selectedCourses[0]);
      }
      if (filtered.length > 0) {
        console.log(`🔍 [DEBUG] Sample available course:`, filtered[0]);
        console.log(
          `🔍 [DEBUG] Sample available course.courses[0].courseNumber:`,
          filtered[0].courses?.[0]?.courseNumber
        );
      }

      // Show all study plan course numbers for debugging
      if (selectedCourseIds.length > 0) {
        console.log(
          `🔍 [DEBUG] ALL study plan course numbers:`,
          selectedCourseIds
        );
      } else {
        console.log(
          `⚠️ [DEBUG] NO study plan course numbers found in selectedCourseIds!`
        );
      }

      // Show first few available course numbers for comparison
      const sampleAvailableCourseNumbers = filtered
        .slice(0, 10)
        .map((c) => c.courses?.[0]?.courseNumber)
        .filter(Boolean);
      if (sampleAvailableCourseNumbers.length > 0) {
        console.log(
          `🔍 [DEBUG] Sample available course numbers:`,
          sampleAvailableCourseNumbers
        );
      }

      const coursesWithRatings = filtered.map((course) => {
        // Try different ways to match ratings to courses
        let rating = null;

        // Method 1: Direct course ID match
        if (ratingsMap[course.id]) {
          rating = ratingsMap[course.id];
        }
        // Method 2: Course number match (direct property)
        else if (course.courseNumber && ratingsMap[course.courseNumber]) {
          rating = ratingsMap[course.courseNumber];
        }
        // Method 3: Course number match (nested in courses array)
        else if (
          course.courses?.[0]?.courseNumber &&
          ratingsMap[course.courses[0].courseNumber]
        ) {
          rating = ratingsMap[course.courses[0].courseNumber];
        }
        // Method 4: Try course shortName
        else if (ratingsMap[course.shortName]) {
          rating = ratingsMap[course.shortName];
        }
        // Method 5: Try alternative properties that might exist
        else {
          // Check what other properties might match
          const possibleKeys = [
            course._id,
            course.number,
            course.title,
            course.name,
          ];
          for (const key of possibleKeys) {
            if (key && ratingsMap[key]) {
              rating = ratingsMap[key];
              break;
            }
          }
        }

        // Check if this available course is also an enrolled course
        // Match enrolled.eventCourseNumber with available.courses[0].courseNumber
        const isEnrolled = enrolledCourses.some((enrolledCourse) => {
          const matches =
            enrolledCourse.eventCourseNumber ===
            course.courses?.[0]?.courseNumber;

          if (matches) {
            console.log(
              `🔍 [DEBUG] ENROLLED MATCH: Available course ${course.shortName} (${course.courses?.[0]?.courseNumber}) matches enrolled course ${enrolledCourse.shortName} (${enrolledCourse.eventCourseNumber})`
            );
          }
          return matches;
        });

        // Check if this course is selected from study plan
        // Study plan provides course numbers like "7,048,1.00"
        // Available courses have course.courses[0].courseNumber
        const courseNumber = course.courses?.[0]?.courseNumber;
        const isSelected =
          courseNumber && selectedCourseIds.includes(courseNumber);

        // Debug specific matches
        if (courseNumber && selectedCourseIds.length > 0) {
          const isMatch = selectedCourseIds.includes(courseNumber);
          if (isMatch) {
            console.log(
              `✅ [DEBUG] MATCH FOUND: ${course.shortName} (${courseNumber}) is in study plan`
            );
          }
          // Log first few to check logic
          if (Math.random() < 0.05) {
            // 5% sampling
            console.log(
              `🔍 [DEBUG] Check: "${courseNumber}" in [${selectedCourseIds
                .slice(0, 3)
                .join(", ")}...] = ${isMatch}`
            );
          }
        }

        // Enhanced debug logging for selection matching
        if (selectedCourseIds.length > 0 && course.courses?.[0]?.courseNumber) {
          // Log every 10th course to avoid spam, or log if it's a match
          if (Math.random() < 0.1 || isSelected) {
            console.log(`🔍 [DEBUG] Selection check for ${course.shortName}:`);
            console.log(
              `  - Available course number: "${course.courses[0].courseNumber}"`
            );
            console.log(
              `  - Study plan course numbers: [${selectedCourseIds
                .slice(0, 3)
                .map((id) => `"${id}"`)
                .join(", ")}...]`
            );
            console.log(`  - Is match: ${isSelected}`);
          }
        }

        // Debug logging for selected status
        if (isSelected) {
          console.log(
            `✅ [DEBUG] Course ${course.shortName} (${course.courses?.[0]?.courseNumber}) marked as SELECTED from study plan`
          );
        }

        // Debug logging for enrolled status
        if (isEnrolled) {
          console.log(
            `🔍 [DEBUG] Course ${course.shortName} marked as ENROLLED`
          );
        }
        if (isSelected) {
          console.log(
            `🔍 [DEBUG] Course ${course.shortName} marked as SELECTED`
          );
        }

        return {
          ...course,
          avgRating: rating || course.avgRating, // Preserve existing rating if found
          enrolled: isEnrolled, // Mark if course is enrolled
          selected: isSelected, // Mark if course is selected
        };
      });

      // Sort courses: enrolled first, then selected, then everything else
      const sortedCoursesWithRatings = coursesWithRatings.sort((a, b) => {
        // Priority 1: Enrolled courses first
        if (a.enrolled && !b.enrolled) return -1;
        if (!a.enrolled && b.enrolled) return 1;

        // Priority 2: Among non-enrolled, selected courses come first
        if (!a.enrolled && !b.enrolled) {
          if (a.selected && !b.selected) return -1;
          if (!a.selected && b.selected) return 1;
        }

        // If same status, maintain original order
        return 0;
      });

      const newData = {
        ...cleanPrev,
        semesters: {
          ...cleanPrev.semesters,
          [semesterShortName]: {
            ...semesterData,
            filtered: sortedCoursesWithRatings,
          },
        },
      };

      console.log(
        `✅ Updated filtered courses for ${semesterShortName}: ${sortedCoursesWithRatings.length} courses`
      );

      // Summary of selected courses
      const selectedCount = sortedCoursesWithRatings.filter(
        (c) => c.selected
      ).length;
      const enrolledCount = sortedCoursesWithRatings.filter(
        (c) => c.enrolled
      ).length;
      console.log(
        `📊 [SUMMARY] Selected: ${selectedCount}, Enrolled: ${enrolledCount}, Total: ${sortedCoursesWithRatings.length}`
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
        selectedCourseIds.includes(a.courseNumber) ||
        selectedCourseIds.includes(a.courses?.[0]?.courseNumber);
      const bSelected =
        selectedCourseIds.includes(b.id) ||
        selectedCourseIds.includes(b.courseNumber) ||
        selectedCourseIds.includes(b.courses?.[0]?.courseNumber);

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
      (courseData.semesters && courseData.semesters[semesterShortName]) ||
      DEFAULT_SEMESTER_STRUCTURE
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
