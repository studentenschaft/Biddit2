import { atom } from "recoil";

/**
 * Unified course data atom that stores all course information by semester shortName
 * This replaces the need for multiple course-related atoms with different formats
 *
 * Structure:
 * {
 *   semesters: {
 *     "HS24": {
 *       enrolled: [], // Courses the user is enrolled in
 *       available: [], // All available courses for this semester
 *       selected: [], // Courses the user has selected/wishlisted
 *       filtered: [], // Filtered courses based on current filter criteria
 *       ratings: {}, // Course ratings by courseNumber
 *       lastFetched: null // When this data was last fetched
 *     },
 *     "FS25": { ... },
 *     // etc.
 *   },
 *   selectedSemester: null, // Currently selected semester shortName
 *   isFutureSemester: false, // Whether selected semester is in the future
 *   referenceSemester: null, // Reference semester for future projections
 *   latestValidTerm: null, // Latest term with actual course data
 * }
 */
export const unifiedCourseDataState = atom({
  key: "unifiedCourseDataState",
  default: {
    semesters: {},
    selectedSemester: null,
    isFutureSemester: false,
    referenceSemester: null,
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
