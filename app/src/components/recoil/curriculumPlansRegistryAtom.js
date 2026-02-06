import { atom } from "recoil";
import { toast } from "react-toastify";
import { STORAGE_KEY as ACTIVE_PLAN_STORAGE_KEY } from "./curriculumPlanAtom";

export const REGISTRY_STORAGE_KEY = "biddit_curriculum_plans_registry";
export const PLAN_STORAGE_PREFIX = "biddit_curriculum_plan__";
const DEFAULT_PLAN_ID = "plan-default";

export const generatePlanId = () =>
  `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const loadRegistryFromStorage = () => {
  try {
    const stored = localStorage.getItem(REGISTRY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[plansRegistry] Error loading registry:", error);
    }
    setTimeout(() => {
      toast.warn("Could not load your saved plans registry.", {
        toastId: "plans-registry-load-error",
        autoClose: 8000,
      });
    }, 0);
    return null;
  }
};

/**
 * Build initial state with automatic migration:
 * - Existing user (has plan data but no registry) → wrap in single "Default Plan"
 * - New user (nothing in storage) → create empty registry with "Default Plan"
 * - Returning user (registry exists) → load as-is
 */
const getInitialState = () => {
  const stored = loadRegistryFromStorage();
  if (stored) return stored;

  const now = new Date().toISOString();
  const hasExistingPlan = localStorage.getItem(ACTIVE_PLAN_STORAGE_KEY) !== null;

  if (import.meta.env.DEV && hasExistingPlan) {
    console.log("[plansRegistry] Migrating existing plan data to registry");
  }

  return {
    activePlanId: DEFAULT_PLAN_ID,
    plans: {
      [DEFAULT_PLAN_ID]: {
        id: DEFAULT_PLAN_ID,
        name: "Default Plan",
        createdAt: now,
        lastModified: now,
      },
    },
    schemaVersion: 1,
  };
};

export const curriculumPlansRegistryState = atom({
  key: "curriculumPlansRegistryState",
  default: getInitialState(),
  effects: [
    ({ onSet }) => {
      onSet((newValue) => {
        try {
          localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(newValue));
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error("[plansRegistry] Error saving registry:", error);
          }
          toast.warn("Could not save plans registry. Storage may be full.", {
            toastId: "plans-registry-save-error",
            autoClose: 8000,
          });
        }
      });
    },
  ],
});
