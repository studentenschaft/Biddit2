/**
 * @deprecated This file is unused. Course selectors have been consolidated into
 * unifiedCourseDataSelectors.js. Safe to delete after verification.
 * Last checked: December 2024
 */

import { selector, selectorFamily } from "recoil";
import {
  unifiedCourseDataState,
  initializedSemestersState,
} from "./unifiedCourseDataAtom";

/**
 * Selector family to get course data for a specific semester
 * Usage: useRecoilValue(semesterDataSelector(semesterKey))
 */
export const semesterDataSelector = selectorFamily({
  key: "semesterDataSelector",
  get:
    (semesterKey) =>
    ({ get }) => {
      const courseData = get(unifiedCourseDataState);
      return (
        (courseData.semesters && courseData.semesters[semesterKey]) || {
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
    },
});

/**
 * Selector family to get specific course array for a semester
 * Usage: useRecoilValue(semesterCoursesSelector({ semester: 'HS24', type: 'enrolled' }))
 */
export const semesterCoursesSelector = selectorFamily({
  key: "semesterCoursesSelector",
  get:
    ({ semester, type }) =>
    ({ get }) => {
      const semesterData = get(semesterDataSelector(semester));
      return semesterData[type] || [];
    },
});

/**
 * Selector to get all available semesters
 */
export const availableSemestersSelector = selector({
  key: "availableSemestersSelector",
  get: ({ get }) => {
    const courseData = get(unifiedCourseDataState);
    // Return semester keys from the nested semesters object
    return courseData.semesters ? Object.keys(courseData.semesters) : [];
  },
});

/**
 * Selector to check if a semester is initialized
 */
export const isSemesterInitializedSelector = selectorFamily({
  key: "isSemesterInitializedSelector",
  get:
    (semesterKey) =>
    ({ get }) => {
      const initializedSemesters = get(initializedSemestersState);
      return initializedSemesters.has(semesterKey);
    },
});

/**
 * Selector to get course statistics for a semester
 */
export const semesterStatsSelector = selectorFamily({
  key: "semesterStatsSelector",
  get:
    (semesterKey) =>
    ({ get }) => {
      const semesterData = get(semesterDataSelector(semesterKey));
      return {
        totalEnrolled: semesterData.enrolled.length,
        totalAvailable: semesterData.available.length,
        totalSelected: semesterData.selected.length,
        totalFiltered: semesterData.filtered.length,
        totalRated: Object.keys(semesterData.ratings).length,
        lastFetched: semesterData.lastFetched,
      };
    },
});

/**
 * Selector family to find a specific course across all arrays in a semester
 */
export const findCourseSelector = selectorFamily({
  key: "findCourseSelector",
  get:
    ({ semester, courseNumber }) =>
    ({ get }) => {
      const semesterData = get(semesterDataSelector(semester));

      // Search in all course arrays
      const enrolled = semesterData.enrolled.find(
        (course) => course.courseNumber === courseNumber
      );
      const available = semesterData.available.find(
        (course) => course.courseNumber === courseNumber
      );
      const selected = semesterData.selected.find(
        (course) => course.courseNumber === courseNumber
      );
      const filtered = semesterData.filtered.find(
        (course) => course.courseNumber === courseNumber
      );

      return {
        course: enrolled || available || selected || filtered || null,
        isEnrolled: !!enrolled,
        isAvailable: !!available,
        isSelected: !!selected,
        isFiltered: !!filtered,
        rating: semesterData.ratings[courseNumber] || null,
      };
    },
});

/**
 * Selector to get all courses across all semesters (flattened)
 */
export const allCoursesSelector = selector({
  key: "allCoursesSelector",
  get: ({ get }) => {
    const courseData = get(unifiedCourseDataState);
    const allCourses = [];

    // Check if semesters property exists
    if (!courseData.semesters) {
      console.warn(
        "[DEPRECATED] courseData.semesters is missing in allCoursesSelector"
      );
      return [];
    }

    Object.entries(courseData.semesters).forEach(([semester, data]) => {
      // Combine all course arrays and add semester info
      [
        ...data.enrolled,
        ...data.available,
        ...data.selected,
        ...data.filtered,
      ].forEach((course) => {
        allCourses.push({
          ...course,
          semester,
          source: data.enrolled.includes(course)
            ? "enrolled"
            : data.available.includes(course)
            ? "available"
            : data.selected.includes(course)
            ? "selected"
            : "filtered",
        });
      });
    });

    // Remove duplicates based on courseNumber and semester
    return allCourses.filter(
      (course, index, self) =>
        index ===
        self.findIndex(
          (c) =>
            c.courseNumber === course.courseNumber &&
            c.semester === course.semester
        )
    );
  },
});

/**
 * Selector to check if the currently selected semester is a future semester
 */
export const isFutureSemesterSelector = selector({
  key: "isFutureSemesterSelector",
  get: ({ get }) => {
    const unifiedData = get(unifiedCourseDataState);
    const selectedSemester = unifiedData.selectedSemester;

    // Check both places for compatibility during migration
    // First check at the semester level (correct structure)
    if (selectedSemester && unifiedData.semesters[selectedSemester]) {
      return unifiedData.semesters[selectedSemester].isFutureSemester || false;
    }

    // Fallback to legacy structure if needed (will be removed later)
    if ("isFutureSemester" in unifiedData) {
      console.warn(
        "[DEPRECATED] Reading isFutureSemester from top level, should be at semester level"
      );
      return unifiedData.isFutureSemester || false;
    }

    return false;
  },
});

/**
 * Selector to get the reference semester for the currently selected semester
 */
export const referenceSemesterSelector = selector({
  key: "referenceSemesterSelector",
  get: ({ get }) => {
    const unifiedData = get(unifiedCourseDataState);
    const selectedSemester = unifiedData.selectedSemester;

    // Check both places for compatibility during migration
    // First check at the semester level (correct structure)
    if (selectedSemester && unifiedData.semesters[selectedSemester]) {
      return unifiedData.semesters[selectedSemester].referenceSemester || null;
    }

    // Fallback to legacy structure if needed (will be removed later)
    if ("referenceSemester" in unifiedData) {
      console.warn(
        "[DEPRECATED] Reading referenceSemester from top level, should be at semester level"
      );
      return unifiedData.referenceSemester;
    }

    return null;
  },
});
