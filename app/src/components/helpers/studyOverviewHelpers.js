/**
 * studyOverviewHelpers.js
 *
 * Shared utility functions and a custom hook for the StudyOverview.
 */

import { useRecoilValue } from "recoil";
import { cisIdListSelector } from "../recoil/cisIdListSelector";
import { calculateSmartSemesterCredits } from "./smartExerciseGroupHandler";
import {
  compareSemesterKeys,
  currentSemesterKey,
  normalizeSemesterKey,
  parseSemesterKey,
} from "../../domain/semester";

/**
 * The current semester shortName: the calendar semester when the term list
 * has it, else the term the university API marks as current, else null.
 */
export const useCurrentSemester = () => {
  const termIdList = useRecoilValue(cisIdListSelector);
  const calendarKey = currentSemesterKey();
  if (termIdList.some((t) => normalizeSemesterKey(t.shortName) === calendarKey)) {
    return calendarKey;
  }
  return termIdList.find((term) => term.isCurrent)?.shortName || null;
};

/**
 * Maps course types to Tailwind CSS background color classes.
 * @param {string} type - The type of the course (e.g., 'core', 'elective', 'contextual', etc.).
 * @returns {string} - Corresponding Tailwind CSS class for background color.
 */
export const getTypeColor = (course) => {
  // keywords for each category
  const typeKeywords = {
    core: ['core', 'core electives'],
    elective: ['elective', 'electives'],
    contextual: ['contextual', 'area of concentration', 'skills']
  };
  
  const colors = {
    core: "bg-green-700",
    elective: "bg-green-500",
    contextual: "bg-green-300"
  };

  const typeClean = course.type.toLowerCase().replace("-wishlist", "").trim();
  
  for (const [category, keywords] of Object.entries(typeKeywords)) {
    if (keywords.some(keyword => typeClean.includes(keyword))) {
      return colors[category];
    }
  }
  
  // Use big_type if available
  if (course.big_type && Object.keys(colors).includes(course.big_type.toLowerCase())) {
    return colors[course.big_type.toLowerCase()];
  }
  
  // Default color for unmatched types
  return "bg-gray-300";
};

/**
 * Canonical semester key ('HS 23' -> 'HS23'). Labels that hold no key
 * (e.g. 'Unassigned') keep their text, without whitespace, for display.
 */
export const removeSpacesFromSemesterName = (semester) =>
  normalizeSemesterKey(semester) || (semester ? semester.replace(/\s+/g, "") : "");

/**
 * Checks if a given semester is in the past relative to the current semester.
 * @param {string} semesterToCheck - The semester to check (e.g., "FS 23").
 * @param {string} currentSemester - The current semester (e.g., "HS 23").
 * @returns {boolean} - True if semesterToCheck is strictly before currentSemester, false otherwise.
 */
export const isSemesterInPast = (semesterToCheck, currentSemester) => {
  if (!parseSemesterKey(semesterToCheck) || !parseSemesterKey(currentSemester)) {
    return false;
  }
  return compareSemesterKeys(semesterToCheck, currentSemester) < 0;
};

/**
 * Filters courses for a given semester, removing wishlist courses if it's in the past.
 * @param {Array} courses - Array of course objects
 * @param {string} semester - Semester string (e.g. "FS 23")
 * @param {string} currentSemester - Current semester string
 * @returns {Array} - Filtered array of courses
 */
export const filterCoursesForSemester = (courses, semester, currentSemester) => {
  if (
    isSemesterInPast(
      removeSpacesFromSemesterName(semester),
      removeSpacesFromSemesterName(currentSemester)
    )
  ) {
    return courses.filter((course) => !course.type.includes("wishlist"));
  }
  return courses;
};

/**
 * Calculates the total ECTS credits for a semester's courses.
 * @param {Array} courses - Array of course objects for the semester.
 * @returns {number} - Total credits for the semester.
 */
export const calculateSemesterCredits = (courses) => {
  return calculateSmartSemesterCredits(courses);
};


/**
 * Sort courses by type priority: core, elective, contextual, then others
 * @param {Array} courses - Array of course objects
 * @returns {Array} - Sorted array of courses
 */
export const sortCoursesByType = (courses) => {
  if (!courses || !Array.isArray(courses)) return [];
  
  // Define type priority (lower number = higher priority)
  const typePriority = {
    "core": 1,
    "core electives": 1,
    "elective": 2,
    "electives": 2,
    "contextual": 3,
    "area of concentration": 3,
    "wishlist": 4
  };
  
  // Default priority for unknown types
  const defaultPriority = 10;
  
  return [...courses].sort((a, b) => {
    // Extract base type (remove -wishlist suffix if present)
    const typeA = a.type.replace(/-wishlist$/, "").toLowerCase();
    const typeB = b.type.replace(/-wishlist$/, "").toLowerCase();
    
    // Get priority or use default
    const priorityA = typePriority[typeA] || defaultPriority;
    const priorityB = typePriority[typeB] || defaultPriority;
    
    // Sort by priority
    return priorityA - priorityB;
  });
};
