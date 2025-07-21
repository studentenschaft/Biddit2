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
          enrolledIds: [],
          available: [],
          selectedIds: [],
          filtered: [],
          studyPlan: [],
          ratings: {},
          lastFetched: null,
          isFutureSemester: false,
          referenceSemester: null,
          cisId: null,
          isCurrent: false,
          isProjected: false,
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
 * Selector to get enrolled course IDs for a specific semester
 * Returns IDs instead of full course objects
 */
export const enrolledCoursesSelector = selectorFamily({
  key: "enrolledCoursesSelector",
  get:
    (semesterShortName) =>
    ({ get }) => {
      const semesterData = get(semesterCourseDataSelector(semesterShortName));
      return semesterData.enrolledIds || [];
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
 * Selector to get selected course IDs for a specific semester
 * Returns IDs instead of full course objects
 */
export const selectedCoursesSelector = selectorFamily({
  key: "selectedCoursesSelector",
  get:
    (semesterShortName) =>
    ({ get }) => {
      const semesterData = get(semesterCourseDataSelector(semesterShortName));
      return semesterData.selectedIds || [];
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
