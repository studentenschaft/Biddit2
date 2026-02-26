import { atom } from "recoil";

export const REGISTRY_STORAGE_KEY = "biddit_curriculum_plans_registry"; // Keep for migration reference
export const PLAN_STORAGE_PREFIX = "biddit_curriculum_plan__"; // Keep for migration reference
const DEFAULT_PLAN_ID = "plan-default";

export const generatePlanId = () =>
  `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Get initial state - now starts empty, populated from API on CurriculumMap mount
 */
const getInitialState = () => ({
  activePlanId: DEFAULT_PLAN_ID,
  plans: {
    [DEFAULT_PLAN_ID]: {
      id: DEFAULT_PLAN_ID,
      name: "Default Plan",
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    },
  },
  schemaVersion: 1,
  isLoaded: false, // Track if data loaded from API
  isNewUser: false, // True if no saved plans on server (404 on GET)
  isDirty: false, // True if user has made changes that need syncing
});

export const curriculumPlansRegistryState = atom({
  key: "curriculumPlansRegistryState",
  default: getInitialState(),
  // No localStorage effects - synced via API
});

