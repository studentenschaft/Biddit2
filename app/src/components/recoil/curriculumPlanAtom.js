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
 *
 * NOTE: Data is now synced via API, not localStorage.
 * State is loaded from server when CurriculumMap mounts and updated via API calls.
 */

export const STORAGE_KEY = 'biddit_curriculum_plan'; // Keep for migration reference

/**
 * Canonical default state shape for a curriculum plan.
 * Used as initial state and as fallback in usePlanManager.
 */
export const getDefaultPlanState = () => ({
  plannedItems: {},
  wishlistOverrides: {},
  // shape: { "FS26": { removedCourseIds: ["ABC123", ...] } }
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
  return `placeholder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Helper: Create a course plan item
 */
export const createCoursePlanItem = (courseId, categoryPath, shortName = null) => ({
  type: "course",
  courseId,
  categoryPath,
  ...(shortName && { shortName }),
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

/**
 * Helper: Get the next semester key in sequence
 * @param {string} semesterKey - Current semester key (e.g., "FS27")
 * @returns {string} - Next semester key (e.g., "HS27")
 */
export const getNextSemesterKey = (semesterKey) => {
  const { type, year } = parseSemesterKey(semesterKey);

  if (type === 'FS') {
    // FS -> HS of same year
    return `HS${year}`;
  } else {
    // HS -> FS of next year
    return `FS${year + 1}`;
  }
};

/**
 * Helper: Get current semester info based on current date
 * HSG academic calendar: HS = September-February, FS = February-July
 *
 * @returns {{ currentSemKey: string, isCurrentlyHS: boolean, currentSemYear: number, nextSemKey: string }}
 */
export const getCurrentSemesterInfo = () => {
  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth();

  // HS runs Sept-Feb (months 8-1), FS runs Feb-Jul (months 1-7)
  const isCurrentlyHS = currentMonth >= 8 || currentMonth <= 1;

  // If we're in Jan/Feb of HS, the year code is previous year (e.g., Jan 2025 = HS24)
  const currentSemYear = isCurrentlyHS && currentMonth <= 1
    ? currentYear - 1
    : currentYear;

  const currentSemKey = `${isCurrentlyHS ? "HS" : "FS"}${currentSemYear}`;
  const nextSemKey = getNextSemesterKey(currentSemKey);

  return {
    currentSemKey,
    isCurrentlyHS,
    currentSemYear,
    nextSemKey,
  };
};

/**
 * Helper: Check if a semester is the current one
 * @param {string} semesterKey - Semester key to check (e.g., "FS25")
 * @returns {boolean}
 */
export const isSemesterCurrent = (semesterKey) => {
  const { currentSemKey } = getCurrentSemesterInfo();
  return semesterKey === currentSemKey;
};

/**
 * Helper: Check if a semester is in the future
 * @param {string} semesterKey - Semester key to check (e.g., "FS25")
 * @returns {boolean}
 */
export const isSemesterInFuture = (semesterKey) => {
  const { currentSemKey } = getCurrentSemesterInfo();
  return compareSemesters(semesterKey, currentSemKey) > 0;
};

/**
 * Helper: Check if a semester is in the past (completed)
 * @param {string} semesterKey - Semester key to check (e.g., "FS25")
 * @returns {boolean}
 */
export const isSemesterCompleted = (semesterKey) => {
  const { currentSemKey } = getCurrentSemesterInfo();
  return compareSemesters(semesterKey, currentSemKey) < 0;
};

/**
 * Helper: Check if a semester is "syncable" (current or next semester)
 * These semesters sync to the backend wishlist, while future ones are local-only
 * @param {string} semesterKey - Semester key to check (e.g., "FS25")
 * @returns {boolean}
 */
export const isSemesterSyncable = (semesterKey) => {
  const { currentSemKey, nextSemKey } = getCurrentSemesterInfo();
  return semesterKey === currentSemKey || semesterKey === nextSemKey;
};

/**
 * Helper: Get semester status for display purposes
 * @param {string} semesterKey - Semester key to check (e.g., "FS25")
 * @returns {"completed" | "current" | "future"}
 */
export const getSemesterStatus = (semesterKey) => {
  if (isSemesterCurrent(semesterKey)) return "current";
  if (isSemesterInFuture(semesterKey)) return "future";
  return "completed";
};

/**
 * Helper: Filter and sort semesters to current and future only
 * Used by CoursePicker and other components that need available semesters
 *
 * @param {string[]} semesterKeys - Array of semester keys to filter
 * @returns {string[]} - Sorted array of current and future semester keys
 */
export const filterCurrentAndFutureSemesters = (semesterKeys) => {
  const { currentSemKey } = getCurrentSemesterInfo();

  return sortSemesters(semesterKeys).filter((semKey) => {
    // Include current and future semesters
    const comparison = compareSemesters(semKey, currentSemKey);
    return comparison >= 0; // Current (0) or future (positive)
  });
};
