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
  studyPlan: [], // Study plan courses for this semester
  ratings: {},
  lastFetched: null,
  isFutureSemester: false,
  referenceSemester: null,
  cisId: null,
  isCurrent: false,
  isProjected: false,
};

/**
 * Helper function to create detailed summary logs for unified course data
 */
const logUnifiedCourseDataSummary = (
  semesterShortName,
  operationType,
  data
) => {
  const semesterData = data.semesters[semesterShortName];
  if (!semesterData) return;

  console.group(
    `📊 [UNIFIED COURSE DATA] ${operationType} - ${semesterShortName}`
  );

  // Semester metadata
  console.log(`🏫 Semester Metadata:`, {
    cisId: semesterData.cisId,
    isCurrent: semesterData.isCurrent,
    isProjected: semesterData.isProjected,
    isFutureSemester: semesterData.isFutureSemester,
    referenceSemester: semesterData.referenceSemester,
    lastFetched: semesterData.lastFetched,
  });

  // Course counts
  console.log(`📚 Course Counts:`, {
    enrolled: semesterData.enrolled?.length || 0,
    available: semesterData.available?.length || 0,
    selected: semesterData.selected?.length || 0,
    filtered: semesterData.filtered?.length || 0,
    studyPlan: semesterData.studyPlan?.length || 0,
    ratings: Object.keys(semesterData.ratings || {}).length,
  });

  // Detailed course data (limited to prevent console spam)
  if (semesterData.enrolled?.length > 0) {
    console.log(
      `✅ Enrolled Courses (${semesterData.enrolled.length}):`,
      semesterData.enrolled.slice(0, 3).map((c) => ({
        id: c.id,
        courseNumber: c.courseNumber,
        title: c.title || c.courses?.[0]?.title,
      }))
    );
  }

  if (semesterData.selected?.length > 0) {
    console.log(
      `⭐ Selected Courses (${semesterData.selected.length}):`,
      semesterData.selected.slice(0, 3).map((c) => ({
        id: c.id,
        courseNumber: c.courseNumber,
        title: c.title || c.courses?.[0]?.title,
      }))
    );
  }

  if (semesterData.available?.length > 0) {
    console.log(
      `🔍 Available Courses (${semesterData.available.length}):`,
      `First 3: ${semesterData.available
        .slice(0, 3)
        .map((c) => c.courseNumber || c.id)
        .join(", ")}`
    );
  }

  console.groupEnd();
};

/**
 * Helper function to log overall unified data state
 */
const logUnifiedDataOverview = (data) => {
  console.group(`🌍 [UNIFIED COURSE DATA] Global Overview`);

  console.log(`🎯 Global State:`, {
    selectedSemester: data.selectedSemester,
    latestValidTerm: data.latestValidTerm,
    totalSemesters: Object.keys(data.semesters || {}).length,
  });

  console.log(
    `📅 All Semesters:`,
    Object.keys(data.semesters || {}).map((semester) => ({
      semester,
      enrolled: data.semesters[semester]?.enrolled?.length || 0,
      available: data.semesters[semester]?.available?.length || 0,
      selected: data.semesters[semester]?.selected?.length || 0,
      isCurrent: data.semesters[semester]?.isCurrent || false,
      isProjected: data.semesters[semester]?.isProjected || false,
      isFutureSemester: data.semesters[semester]?.isFutureSemester || false,
    }))
  );

  console.groupEnd();
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
      logUnifiedCourseDataSummary(semesterShortName, "INITIALIZE", newData);
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
      logUnifiedCourseDataSummary(
        semesterShortName,
        "UPDATE_ENROLLED",
        newData
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
      logUnifiedCourseDataSummary(
        semesterShortName,
        "UPDATE_AVAILABLE",
        newData
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
      logUnifiedCourseDataSummary(
        semesterShortName,
        "UPDATE_SELECTED",
        newData
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

      const newData = {
        ...cleanPrev,
        semesters: {
          ...cleanPrev.semesters,
          [semesterShortName]: {
            ...existingSemester,
            selected: [...currentSelected, course],
          },
        },
      };

      console.log(`➕ Added course to ${semesterShortName}:`, {
        courseId: course.id,
        courseNumber: course.courseNumber,
        title: course.title || course.courses?.[0]?.title,
      });
      logUnifiedCourseDataSummary(
        semesterShortName,
        "ADD_SELECTED_COURSE",
        newData
      );
      return newData;
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

      const newData = {
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

      console.log(`➖ Removed course from ${semesterShortName}:`, { courseId });
      logUnifiedCourseDataSummary(
        semesterShortName,
        "REMOVE_SELECTED_COURSE",
        newData
      );
      return newData;
    });
  };

  /**
   * Update study plan courses for a semester
   */
  const updateStudyPlan = (semesterShortName, studyPlanCourses) => {
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
            studyPlan: studyPlanCourses,
            lastFetched: new Date().toISOString(),
          },
        },
      };

      console.log(
        `✅ Updated study plan for ${semesterShortName}:`,
        newData.semesters[semesterShortName].studyPlan
      );
      logUnifiedCourseDataSummary(
        semesterShortName,
        "UPDATE_STUDY_PLAN",
        newData
      );
      return newData;
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
  const updateFilteredCourses = (semesterShortName, filterOptions = {}) => {
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
        `🔍 Filtering ${coursesToFilter.length} available courses for ${semesterShortName} with options:`,
        filterOptions
      );

      // Apply filter criteria
      const filtered = coursesToFilter.filter((course) => {
        return applyFilterCriteria(course, filterOptions);
      });

      // Attach ratings and status FIRST, then sort
      const ratingsMap = semesterData.ratings || {};
      const enrolledCourses = semesterData.enrolled || [];

      // Get study plan course numbers directly from semester data
      const studyPlanData = semesterData.studyPlan || [];

      // Extract course numbers from study plan data
      // Study plan data can be either strings like "7,048,1.00" or objects with courseNumber property
      const selectedCourseIds = studyPlanData
        .map((course) => {
          if (typeof course === "string") {
            return course; // Direct string like "7,048,1.00"
          } else if (course.courseNumber) {
            return course.courseNumber; // Object with courseNumber property
          } else {
            return course; // Fallback to course itself
          }
        })
        .filter(Boolean);

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
          return (
            enrolledCourse.eventCourseNumber ===
            course.courses?.[0]?.courseNumber
          );
        });

        // Check if this course is selected from study plan
        // Study plan provides course numbers like "7,048,1.00"
        // Available courses have course.courses[0].courseNumber
        const courseNumber = course.courses?.[0]?.courseNumber;
        const isSelected =
          courseNumber && selectedCourseIds.includes(courseNumber);

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
   * Update filtered courses for ALL semesters at once
   * Useful when filter criteria changes globally
   * Now handles study plan data directly instead of using legacy selectedCourseIds atom
   */
  const updateFilteredCoursesForAllSemesters = (filterOptions = {}) => {
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

          // Apply the same enrollment/selection logic as in updateFilteredCourses
          const ratingsMap = semesterData.ratings || {};
          const enrolledCourses = semesterData.enrolled || [];
          const studyPlanCourses = semesterData.studyPlan || [];

          const coursesWithStatus = filtered.map((course) => {
            // Rating attachment logic (same as main function)
            let rating = null;
            if (ratingsMap[course.id]) {
              rating = ratingsMap[course.id];
            } else if (course.courseNumber && ratingsMap[course.courseNumber]) {
              rating = ratingsMap[course.courseNumber];
            } else if (
              course.courses?.[0]?.courseNumber &&
              ratingsMap[course.courses[0].courseNumber]
            ) {
              rating = ratingsMap[course.courses[0].courseNumber];
            } else if (ratingsMap[course.shortName]) {
              rating = ratingsMap[course.shortName];
            }

            // Enrollment check
            const isEnrolled = enrolledCourses.some((enrolledCourse) => {
              return (
                enrolledCourse.eventCourseNumber ===
                course.courses?.[0]?.courseNumber
              );
            });

            // Study plan selection check
            const courseNumber = course.courses?.[0]?.courseNumber;
            const isSelected =
              courseNumber &&
              studyPlanCourses.some((studyPlanCourse) => {
                return studyPlanCourse.courseNumber === courseNumber;
              });

            return {
              ...course,
              avgRating: rating || course.avgRating,
              enrolled: isEnrolled,
              selected: isSelected,
            };
          });

          // Sort courses: enrolled first, then selected, then everything else
          const sortedFiltered = coursesWithStatus.sort((a, b) => {
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

  /**
   * Log a detailed summary of the current unified course data state
   */
  const logUnifiedDataState = () => {
    logUnifiedDataOverview(courseData);
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
    updateStudyPlan, // New function for study plan data
    updateCourseRatings,
    updateCourseRatingsForSemester: updateCourseRatings, // Alias for consistency
    updateCourseRatingsForAllSemesters, // New function for global ratings
    updateFilteredCourses, // New function for filtered courses
    updateFilteredCoursesForSemester: updateFilteredCourses, // Alias for consistency
    updateFilteredCoursesForAllSemesters, // New function for global filtered courses
    getSemesterData,
    needsRefresh,
    logUnifiedDataState, // Debug function to log current state
  };
}
