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
        courseData[semesterKey] || {
          enrolled: [],
          available: [],
          selected: [],
          filtered: [],
          ratings: {},
          lastFetched: null,
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
    return Object.keys(courseData);
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

    Object.entries(courseData).forEach(([semester, data]) => {
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
