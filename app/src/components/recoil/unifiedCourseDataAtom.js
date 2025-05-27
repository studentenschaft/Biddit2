import { atom } from "recoil";

/**
 * Unified course data atom that stores all course information by semester shortName
 * This replaces the need for multiple course-related atoms with different formats
 *
 * Structure:
 * {
 *   "HS24": {
 *     enrolled: [], // Courses the user is enrolled in
 *     available: [], // All available courses for this semester
 *     selected: [], // Courses the user has selected/wishlisted
 *     ratings: {}, // Course ratings by courseNumber
 *     lastFetched: null // When this data was last fetched
 *   },
 *   "FS25": { ... },
 *   // etc.
 * }
 */
export const unifiedCourseDataState = atom({
  key: "unifiedCourseDataState",
  default: {},
});

/**
 * Atom to track which semesters have been initialized
 * This helps avoid unnecessary re-fetching
 */
export const initializedSemestersState = atom({
  key: "initializedSemestersState",
  default: new Set(),
});
