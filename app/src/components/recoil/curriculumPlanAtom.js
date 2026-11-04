import { atom } from "recoil";
import {
  parseSemesterKey,
  compareSemesterKeys,
  sortSemesterKeys,
  nextSemesterKey,
  currentSemesterKey,
  semesterStatus,
} from "../../domain/semester";

/**
 * Curriculum Plan Atom
 *
 * Stores long-term curriculum planning data that extends beyond the current wishlist.
 * This enables students to plan future semesters with placeholders and track progress
 * toward degree requirements.
 *
 * Key differences from the wishlist (unifiedCourseDataState selectedIds):
 * - Supports "placeholder" items (generic credit allocations without specific courses)
 * - Stores category path assignments for proper grid placement
 * - Maintains validation state for conflicts and warnings
 * - Designed for multi-semester planning beyond current/next semester
 *
 * Data Flow:
 * 1. Wishlist courses: unifiedCourseDataState.semesters[semKey].selectedIds
 * 2. Future semester courses: curriculumPlanState (this atom)
 * 3. Combined view: curriculumMapSelector (merges both)
 *
 * NOTE: Data is now synced via API, not localStorage.
 * State is loaded from server when CurriculumMap mounts and updated via API calls.
 */

export const STORAGE_KEY = "biddit_curriculum_plan"; // Keep for migration reference

/**
 * Canonical default state shape for a curriculum plan.
 * Used as initial state and as fallback in usePlanManager.
 */
export const getDefaultPlanState = () => ({
  plannedItems: {},
  wishlistOverrides: {},
  // shape: { "FS26": { removedCourseIds: ["ABC123", ...] } }
  semesterNotes: {},
  specialization: null,
  validations: {
    conflicts: [],
    categoryWarnings: [],
    availabilityWarnings: [],
  },
  syncStatus: {
    lastSynced: null,
    pendingChanges: [],
    syncError: null,
  },
  lastModified: null,
});

export const curriculumPlanState = atom({
  key: "curriculumPlanState",
  default: getDefaultPlanState(),
  // No localStorage effects - synced via API
});

/**
 * Helper: Generate a unique ID for placeholders
 */
export const generatePlaceholderId = () => {
  return `placeholder-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Helper: Create a course plan item
 */
export const createCoursePlanItem = (
  courseId,
  categoryPath,
  shortName = null,
) => ({
  type: "course",
  courseId,
  categoryPath,
  ...(shortName && { shortName }),
  addedAt: new Date().toISOString(),
});

/**
 * Helper: Create a placeholder plan item
 */
export const createPlaceholderItem = (
  categoryPath,
  credits,
  label = "TBD",
) => ({
  type: "placeholder",
  id: generatePlaceholderId(),
  categoryPath,
  credits,
  label,
  addedAt: new Date().toISOString(),
});

// Semester helpers. The calendar rule and key arithmetic live in
// src/domain/semester.js; these names stay exported for existing importers.
export {
  parseSemesterKey,
  compareSemesterKeys as compareSemesters,
  sortSemesterKeys as sortSemesters,
  nextSemesterKey as getNextSemesterKey,
};

/**
 * Semester keys from the current calendar semester onwards.
 * @param {number} count - Number of semesters to generate
 * @returns {string[]} - e.g. ["HS25", "FS26", "HS26"]
 */
export const generateFutureSemesters = (count = 6) => {
  const semesters = [];
  let key = currentSemesterKey();
  for (let i = 0; i < count; i++) {
    semesters.push(key);
    key = nextSemesterKey(key);
  }
  return semesters;
};

/**
 * @returns {{ currentSemKey: string, isCurrentlyHS: boolean, currentSemYear: number, nextSemKey: string }}
 */
export const getCurrentSemesterInfo = () => {
  const currentSemKey = currentSemesterKey();
  const { season, year } = parseSemesterKey(currentSemKey);
  return {
    currentSemKey,
    isCurrentlyHS: season === "HS",
    currentSemYear: year,
    nextSemKey: nextSemesterKey(currentSemKey),
  };
};

export const isSemesterCurrent = (semesterKey) =>
  semesterStatus(semesterKey) === "current";

export const isSemesterInFuture = (semesterKey) =>
  semesterStatus(semesterKey) === "future";

export const isSemesterCompleted = (semesterKey) =>
  semesterStatus(semesterKey) === "completed";

/**
 * Current and next semester sync to the backend wishlist; later ones are local-only.
 */
export const isSemesterSyncable = (semesterKey) => {
  const currentSemKey = currentSemesterKey();
  return (
    semesterKey === currentSemKey ||
    semesterKey === nextSemesterKey(currentSemKey)
  );
};

/** @returns {"completed" | "current" | "future"} */
export const getSemesterStatus = (semesterKey) => semesterStatus(semesterKey);

/**
 * Current and future semesters, sorted (CoursePicker and friends).
 */
export const filterCurrentAndFutureSemesters = (semesterKeys) =>
  sortSemesterKeys(semesterKeys).filter(
    (semKey) => semesterStatus(semKey) !== "completed",
  );
