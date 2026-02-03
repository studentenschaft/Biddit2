import { atom } from "recoil";

/**
 * Curriculum Plan Atom
 *
 * Stores long-term curriculum planning data that extends beyond the current wishlist.
 * This enables students to plan future semesters with placeholders and track progress
 * toward degree requirements.
 *
 * Key differences from localSelectedCoursesSemKeyState:
 * - Supports "placeholder" items (generic credit allocations without specific courses)
 * - Stores category path assignments for proper grid placement
 * - Maintains validation state for conflicts and warnings
 * - Designed for multi-semester planning beyond current/next semester
 *
 * Data Flow:
 * 1. Current semester courses: localSelectedCoursesSemKeyState (existing wishlist)
 * 2. Future semester courses: curriculumPlanState (this atom)
 * 3. Combined view: curriculumMapSelector (merges both)
 */

const STORAGE_KEY = 'biddit_curriculum_plan';

/**
 * Load plan from localStorage
 */
const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('[curriculumPlanAtom] Error loading from storage:', error);
    return null;
  }
};

/**
 * Get initial state, merging localStorage with defaults
 */
const getInitialState = () => {
  const stored = loadFromStorage();
  const defaults = {
    // Planned items per semester (courses and placeholders for future semesters)
    // Format: { "FS25": [{ type, courseId/id, categoryPath, credits, label?, addedAt }] }
    plannedItems: {},

    // User's chosen specialization/focus area (if program has tracks)
    // MVP: null (defer specialization handling)
    specialization: null,

    // Cached validation results (updated by curriculumValidationSelector)
    validations: {
      // Schedule conflicts within a semester
      conflicts: [],
      // Category credit limit warnings
      categoryWarnings: [],
      // Course not offered in planned semester warnings
      availabilityWarnings: [],
    },

    // Synchronization state with backend
    syncStatus: {
      lastSynced: null,
      pendingChanges: [],
      syncError: null,
    },

    // Metadata
    lastModified: null,
  };

  if (stored) {
    return {
      ...defaults,
      ...stored,
      validations: { ...defaults.validations, ...stored.validations },
      syncStatus: { ...defaults.syncStatus, ...stored.syncStatus },
    };
  }

  return defaults;
};

export const curriculumPlanState = atom({
  key: "curriculumPlanState",
  default: getInitialState(),
  effects: [
    // localStorage persistence effect
    ({ onSet }) => {
      onSet((newValue) => {
        try {
          const toStore = {
            ...newValue,
            lastModified: new Date().toISOString(),
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
        } catch (error) {
          console.error('[curriculumPlanAtom] Error saving to storage:', error);
        }
      });
    },
  ],
});

/**
 * Helper: Generate a unique ID for placeholders
 */
export const generatePlaceholderId = () => {
  return `placeholder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Helper: Create a course plan item
 */
export const createCoursePlanItem = (courseId, categoryPath) => ({
  type: "course",
  courseId,
  categoryPath,
  addedAt: new Date().toISOString(),
});

/**
 * Helper: Create a placeholder plan item
 */
export const createPlaceholderItem = (categoryPath, credits, label = "TBD") => ({
  type: "placeholder",
  id: generatePlaceholderId(),
  categoryPath,
  credits,
  label,
  addedAt: new Date().toISOString(),
});

/**
 * Helper: Generate future semester keys from current date
 * @param {number} count - Number of future semesters to generate
 * @returns {string[]} - Array of semester keys like ["FS25", "HS25", "FS26"]
 */
export const generateFutureSemesters = (count = 6) => {
  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth();

  // HSG semesters: HS = September-February, FS = February-July
  // Consider HS current if we're in Aug-Jan, FS current if Feb-Jul
  const isHerbstsemester = currentMonth >= 7 || currentMonth <= 1;

  const semesters = [];
  let year = currentYear;
  let isFall = isHerbstsemester;

  for (let i = 0; i < count; i++) {
    semesters.push(`${isFall ? 'HS' : 'FS'}${year}`);
    if (!isFall) year++;
    isFall = !isFall;
  }

  return semesters;
};

/**
 * Helper: Parse semester key into components
 * @param {string} semesterKey - e.g., "HS24"
 * @returns {{ type: 'HS'|'FS', year: number, fullYear: number }}
 */
export const parseSemesterKey = (semesterKey) => {
  const type = semesterKey.substring(0, 2);
  const year = parseInt(semesterKey.substring(2), 10);
  const fullYear = year < 50 ? 2000 + year : 1900 + year;
  return { type, year, fullYear };
};

/**
 * Helper: Compare two semester keys chronologically
 * @returns {number} - Negative if a < b, positive if a > b, 0 if equal
 */
export const compareSemesters = (a, b) => {
  const parsedA = parseSemesterKey(a);
  const parsedB = parseSemesterKey(b);

  // Compare years first
  if (parsedA.fullYear !== parsedB.fullYear) {
    return parsedA.fullYear - parsedB.fullYear;
  }

  // Same year: FS comes before HS within the same calendar year
  // Actually HS23 starts Sept 2023, FS24 starts Feb 2024
  // So HS23 < FS24 but within "year 24": FS24 < HS24
  if (parsedA.type !== parsedB.type) {
    return parsedA.type === 'FS' ? -1 : 1;
  }

  return 0;
};

/**
 * Helper: Sort semester keys chronologically
 */
export const sortSemesters = (semesterKeys) => {
  return [...semesterKeys].sort(compareSemesters);
};
