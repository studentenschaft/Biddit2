import { selector, selectorFamily } from "recoil";
import { unifiedCourseDataState } from "./unifiedCourseDataAtom";

/**
 * Selector to get all course data for a specific semester
 */
export const semesterCourseDataSelector = selectorFamily({
  key: "semesterCourseDataSelector",
  get:
    (semesterShortName) =>
    ({ get }) => {
      const allCourseData = get(unifiedCourseDataState);
      return (
        allCourseData.semesters[semesterShortName] || {
          enrolled: [],
          available: [],
          selected: [],
          ratings: {},
          lastFetched: null,
        }
      );
    },
});

/**
 * Selector to get the currently selected semester
 */
export const selectedSemesterSelector = selector({
  key: "selectedSemesterSelector",
  get: ({ get }) => {
    const courseData = get(unifiedCourseDataState);
    return courseData.selectedSemester;
  },
});

/**
 * Selector to get future semester status
 */
export const isFutureSemesterSelector = selector({
  key: "isFutureSemesterSelector",
  get: ({ get }) => {
    const courseData = get(unifiedCourseDataState);
    return courseData.isFutureSemester;
  },
});

/**
 * Selector to get reference semester for future projections
 */
export const referenceSemesterSelector = selector({
  key: "referenceSemesterSelector",
  get: ({ get }) => {
    const courseData = get(unifiedCourseDataState);
    return courseData.referenceSemester;
  },
});

/**
 * Selector to get latest valid term
 */
export const latestValidTermSelector = selector({
  key: "latestValidTermSelector",
  get: ({ get }) => {
    const courseData = get(unifiedCourseDataState);
    return courseData.latestValidTerm;
  },
});

/**
 * Selector to get enrolled courses for a specific semester
 */
export const enrolledCoursesSelector = selectorFamily({
  key: "enrolledCoursesSelector",
  get:
    (semesterShortName) =>
    ({ get }) => {
      const semesterData = get(semesterCourseDataSelector(semesterShortName));
      return semesterData.enrolled || [];
    },
});

/**
 * Selector to get available courses for a specific semester
 */
export const availableCoursesSelector = selectorFamily({
  key: "availableCoursesSelector",
  get:
    (semesterShortName) =>
    ({ get }) => {
      const semesterData = get(semesterCourseDataSelector(semesterShortName));
      return semesterData.available || [];
    },
});

/**
 * Selector to get selected/wishlisted courses for a specific semester
 */
export const selectedCoursesSelector = selectorFamily({
  key: "selectedCoursesSelector",
  get:
    (semesterShortName) =>
    ({ get }) => {
      const semesterData = get(semesterCourseDataSelector(semesterShortName));
      return semesterData.selected || [];
    },
});

/**
 * Selector to get all courses (enrolled + selected) for the currently selected semester
 * This replaces allCourseInfoState usage in most components
 */
export const currentSemesterAllCoursesSelector = selector({
  key: "currentSemesterAllCoursesSelector",
  get: ({ get }) => {
    const selectedSemester = get(selectedSemesterSelector);
    if (!selectedSemester) return [];

    const enrolled = get(enrolledCoursesSelector(selectedSemester));
    const selected = get(selectedCoursesSelector(selectedSemester));

    // Merge and deduplicate courses
    const allCourses = [...enrolled, ...selected];
    const uniqueCourses = allCourses.filter(
      (course, index, arr) =>
        arr.findIndex(
          (c) => c.id === course.id || c.courseNumber === course.courseNumber
        ) === index
    );

    return uniqueCourses;
  },
});

/**
 * Selector to get course ratings for a specific semester
 */
export const semesterRatingsSelector = selectorFamily({
  key: "semesterRatingsSelector",
  get:
    (semesterShortName) =>
    ({ get }) => {
      const semesterData = get(semesterCourseDataSelector(semesterShortName));
      return semesterData.ratings || {};
    },
});

/**
 * Legacy compatibility selector - maps old numeric format to new semester-based format
 * This helps during migration period
 */
export const legacyCourseInfoSelector = selector({
  key: "legacyCourseInfoSelector",
  get: ({ get }) => {
    const allCourseData = get(unifiedCourseDataState);
    const legacyFormat = {};

    // Map semester shortNames to legacy numeric keys
    // This is a temporary solution during migration
    const semesterKeys = Object.keys(allCourseData.semesters).sort();
    semesterKeys.forEach((semesterKey, index) => {
      const semesterData = allCourseData.semesters[semesterKey];
      const allCourses = [
        ...(semesterData.enrolled || []),
        ...(semesterData.selected || []),
      ];

      // Deduplicate
      const uniqueCourses = allCourses.filter(
        (course, idx, arr) =>
          arr.findIndex(
            (c) => c.id === course.id || c.courseNumber === course.courseNumber
          ) === idx
      );

      legacyFormat[index + 1] = uniqueCourses;
    });

    return legacyFormat;
  },
});

/**
 * Selector to get all semesters course data
 * Returns the complete unified course data structure
 */
export const allSemesterCoursesSelector = selector({
  key: "allSemesterCoursesSelector",
  get: ({ get }) => {
    const allCourseData = get(unifiedCourseDataState);
    return allCourseData.semesters;
  },
});

/**
 * Selector to check if a semester is marked as current
 */
export const semesterIsCurrentSelector = selectorFamily({
  key: "semesterIsCurrentSelector",
  get:
    (semesterShortName) =>
    ({ get }) => {
      const semesterData = get(semesterCourseDataSelector(semesterShortName));
      return semesterData.isCurrent || false;
    },
});

/**
 * Selector to check if a semester is projected
 */
export const semesterIsProjectedSelector = selectorFamily({
  key: "semesterIsProjectedSelector",
  get:
    (semesterShortName) =>
    ({ get }) => {
      const semesterData = get(semesterCourseDataSelector(semesterShortName));
      return semesterData.isProjected || false;
    },
});

/**
 * Selector to get semester metadata (isCurrent, isProjected, isFutureSemester, etc.)
 */
export const semesterMetadataSelector = selectorFamily({
  key: "semesterMetadataSelector",
  get:
    (semesterShortName) =>
    ({ get }) => {
      const semesterData = get(semesterCourseDataSelector(semesterShortName));
      return {
        isCurrent: semesterData.isCurrent || false,
        isProjected: semesterData.isProjected || false,
        isFutureSemester: semesterData.isFutureSemester || false,
        referenceSemester: semesterData.referenceSemester || null,
        cisId: semesterData.cisId || null,
        lastFetched: semesterData.lastFetched || null,
      };
    },
});

/**
 * Selector to get courses for a specific semester by type (enrolled, available, selected, filtered)
 * This is the main selector used by EventListContainer
 */
export const semesterCoursesSelector = selectorFamily({
  key: "semesterCoursesSelector",
  get:
    ({ semester, type = "available" }) =>
    ({ get }) => {
      const semesterData = get(semesterCourseDataSelector(semester));

      // Handle different course types
      switch (type) {
        case "enrolled":
          return semesterData.enrolled || [];
        case "available":
          return semesterData.available || [];
        case "selected":
          return semesterData.selected || [];
        case "filtered":
          // Return the actual filtered courses from the semester data
          return semesterData.filtered || [];
        default:
          return semesterData.available || [];
      }
    },
});
