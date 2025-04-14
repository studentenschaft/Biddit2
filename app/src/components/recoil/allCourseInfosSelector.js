// allCourseInfosSelector.js

import { selector } from "recoil";
import { courseInfoState } from "./courseInfoAtom";
import { enrolledCoursesState } from "./enrolledCoursesAtom";
import { shsgCourseRatingsState } from "./shsgCourseRatingsAtom";
import { localSelectedCoursesState } from "./localSelectedCoursesAtom";
import moment from "moment/moment";

// Cache for calendar event time calculations to avoid repeated moment operations
const calendarCache = new Map();

/**
 * Flatten the courses so that each top-level course AND any sub-courses appear in a single array.
 * Also filter the parent's `calendarEntry` to match the sub-course's courseNumber.
 */
const flattenCourses = (courseInfoList) => {
  if (!Array.isArray(courseInfoList)) return [];
  
  const flattened = [];
  for (const parent of courseInfoList) {
    if (parent.courses?.length > 0) {
      for (const subCourse of parent.courses) {
        const filteredCalendar = parent.calendarEntry?.filter(
          (entry) => entry.courseNumber === subCourse.courseNumber
        ) || [];
        const combinedCourse = {
          ...parent,
          ...subCourse,
          isSubCourse: true,
          calendarEntry: filteredCalendar
        };
        // If this sub-course is an exercise group, remove its credit points.
        if (!subCourse.courseNumber?.endsWith("1.00")) {
          combinedCourse.credits = 0;
        }
        flattened.push(combinedCourse);
      }
    } else {
      let filteredCalendar = parent.calendarEntry || [];
      if (parent.courseNumber && filteredCalendar.length > 0) {
        filteredCalendar = filteredCalendar.filter(
          (entry) => entry.courseNumber === parent.courseNumber
        );
      }
      flattened.push({
        ...parent,
        calendarEntry: filteredCalendar
      });
    }
  }
  return flattened;
};

/**
 * Build a Map for quick ratings lookup (O(1) instead of O(n))
 */
const buildRatingsMap = (ratings) => {
  const ratingsMap = new Map();
  if (Array.isArray(ratings)) {
    for (const rating of ratings) {
      if (rating?._id) {
        ratingsMap.set(rating._id, rating.avgRating);
      }
    }
  }
  return ratingsMap;
};

/**
 * Build a Set of course identifiers for enrolled courses (O(1) lookup)
 */
const buildEnrollmentSet = (enrolledCoursesList) => {
  const enrollmentSet = new Set();
  if (Array.isArray(enrolledCoursesList)) {
    for (const course of enrolledCoursesList) {
      if (course.courseNumber) enrollmentSet.add(course.courseNumber);
      if (course.shortName) enrollmentSet.add(course.shortName);
      if (course.eventCourseNumber) enrollmentSet.add(course.eventCourseNumber);
    }
  }
  return enrollmentSet;
};

/**
 * Build a Set of course identifiers for selected courses (O(1) lookup)
 */
const buildSelectionSet = (selectedCoursesList) => {
  const selectionSet = new Set();
  if (Array.isArray(selectedCoursesList)) {
    for (const course of selectedCoursesList) {
      if (course.courseNumber) selectionSet.add(course.courseNumber);
      if (course.shortName) selectionSet.add(course.shortName);
    }
  }
  return selectionSet;
};

/**
 * Calculate course times for overlap detection, with caching
 */
const getCourseTimes = (course) => {
  if (!course.calendarEntry?.length) return [];
  
  // Use courseNumber, shortName, or _id as cache key
  const cacheKey = course.courseNumber || course.shortName || course._id;
  if (calendarCache.has(cacheKey)) {
    return calendarCache.get(cacheKey);
  }
  
  const times = course.calendarEntry.map(entry => {
    const startDate = moment(entry.eventDate);
    const endDate = moment(startDate).add(entry.durationInMinutes, "minutes");
    return { startDate, endDate, weekDay: startDate.day() };
  });
  
  calendarCache.set(cacheKey, times);
  return times;
};

/**
 * Optimized overlap detection between two sets of calendar times
 */
const hasOverlap = (times1, times2) => {
  if (!times1.length || !times2.length) return false;
  
  const weekDays1 = new Set(times1.map(t => t.weekDay));
  const hasCommonDay = times2.some(t => weekDays1.has(t.weekDay));
  if (!hasCommonDay) return false;
  
  for (const { startDate: start1, endDate: end1 } of times1) {
    for (const { startDate: start2, endDate: end2 } of times2) {
      if (
        (start1.isBefore(end2) && end1.isAfter(start2)) ||
        start1.isSame(start2) ||
        end1.isSame(end2)
      ) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Optimized overlap detection using an interval tree approach (nested loops for simplicity)
 */
const detectOverlaps = (courses) => {
  const activeCourses = courses.filter(course =>
    (course.enrolled || course.selected) && course.calendarEntry?.length
  );
  
  if (activeCourses.length <= 1) {
    return courses.map(c => ({ ...c, overlapping: false }));
  }
  
  const courseTimes = new Map();
  for (const course of activeCourses) {
    courseTimes.set(course, getCourseTimes(course));
  }
  
  const overlaps = new Map();
  for (let i = 0; i < activeCourses.length; i++) {
    const course1 = activeCourses[i];
    const times1 = courseTimes.get(course1);
    for (let j = i + 1; j < activeCourses.length; j++) {
      const course2 = activeCourses[j];
      if (
        course1.courseNumber === course2.courseNumber &&
        course1.shortName === course2.shortName
      ) {
        continue;
      }
      const times2 = courseTimes.get(course2);
      if (hasOverlap(times1, times2)) {
        overlaps.set(course1, true);
        overlaps.set(course2, true);
      }
    }
  }
  
  return courses.map(course => ({
    ...course,
    overlapping: overlaps.has(course)
  }));
};

/**
 * Enrich a list of courses with:
 *  - Enrollment flags
 *  - Selected flags
 *  - Average rating
 *  - Overlap detection
 */
const enrichCoursesWithRatingsAndEnrollment = (
  courseInfoList,
  enrolledCoursesList,
  ratings,
  localSelectedCourses
) => {
  if (!courseInfoList?.length) return [];
  
  const ratingsMap = buildRatingsMap(ratings);
  const enrollmentSet = buildEnrollmentSet(enrolledCoursesList);
  const selectionSet = buildSelectionSet(localSelectedCourses);
  
  const enrichedCourses = courseInfoList.map((courseInfo) => ({
    ...courseInfo,
    enrolled: enrollmentSet.has(courseInfo.courseNumber) ||
              enrollmentSet.has(courseInfo.shortName) ||
              enrollmentSet.has(courseInfo.eventCourseNumber),
    selected: selectionSet.has(courseInfo.courseNumber) ||
              selectionSet.has(courseInfo.shortName),
    avgRating: ratingsMap.get(courseInfo.courseNumber) || "N/A"
  }));
  
  const coursesWithOverlap = detectOverlaps(enrichedCourses);
  
  // Sort: enrolled first, then selected (using numeric conversion for booleans)
  return coursesWithOverlap.sort((a, b) => {
    const enrolledDiff = Number(b.enrolled) - Number(a.enrolled);
    if (enrolledDiff !== 0) return enrolledDiff;
    return Number(b.selected) - Number(a.selected);
  });
};

export const allCourseInfoState = selector({
  key: "allCourseInfoState",
  get: ({ get }) => {
    const courseInfo = get(courseInfoState);
    const enrolledCourses = get(enrolledCoursesState);
    const ratings = get(shsgCourseRatingsState);
    const localSelectedCourses = get(localSelectedCoursesState);

    // Clear cache between selector evaluations
    calendarCache.clear();
    
    const enrichedCourses = {};
    for (const semester of Object.keys(courseInfo)) {
      const flattenedCourses = flattenCourses(courseInfo[semester]);
      enrichedCourses[semester] = enrichCoursesWithRatingsAndEnrollment(
        flattenedCourses,
        enrolledCourses[semester] || [],
        ratings,
        localSelectedCourses[semester] || []
      );
    }
    
    return enrichedCourses;
  },
});