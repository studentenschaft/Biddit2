import { atom } from "recoil";

/**
 * Unified course data atom that stores all course information by semester shortName
 * This replaces the need for multiple course-related atoms with different formats
 *
 * SIMPLIFIED STRUCTURE:
 * {
 *   semesters: {
 *     "HS24": {
 *       enrolledIds: [], // Course IDs/numbers that the user is enrolled in
 *       available: [], // All available courses for this semester (full course objects)
 *       selectedIds: [], // Course IDs/numbers that the user has selected/wishlisted
 *       filtered: [], // Filtered courses based on current filter criteria (includes selected/enrolled flags)
 *       studyPlan: [], // Raw study plan data from SHSG API for this semester: Course IDs/numbers
 *       ratings: {}, // Course ratings by courseNumber
 *       lastFetched: null, // When this data was last fetched
 *       isFutureSemester: false, // Whether semester is in the future
 *       referenceSemester: null, // Reference semester for future projections
 *       cisId: null, // CIS ID for the semester
 *       isCurrent: false, // Whether this semester is marked as current by API
 *       isProjected: false // Whether this is a projected future semester
 *     },
 *     "FS25": { ... },
 *     // etc.
 *   },
 *   selectedSemester: null, // Currently selected semester shortName
 *   latestValidTerm: null, // Latest term with actual course data
 * }
 */

// FIXED: Structure now correctly stores isFutureSemester and referenceSemester at semester level
// FIXED: Each semester has proper flags for future status and reference semester
export const unifiedCourseDataState = atom({
  key: "unifiedCourseDataState",
  default: {
    semesters: {},
    selectedSemester: null,
    latestValidTerm: null,
  },
});

/**
 * Atom to track which semesters have been initialized
 * This helps avoid unnecessary re-fetching
 */
export const initializedSemestersState = atom({
  key: "initializedSemestersState",
  default: new Set(),
});
