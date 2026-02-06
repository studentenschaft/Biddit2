import { useCallback } from "react";
import { useRecoilCallback } from "recoil";
import { toast } from "react-toastify";
import { curriculumPlanState } from "../recoil/curriculumPlanAtom";
import {
  curriculumPlansRegistryState,
  generatePlanId,
  PLAN_STORAGE_PREFIX,
} from "../recoil/curriculumPlansRegistryAtom";

// --- localStorage helpers ---

const savePlanToStorage = (planId, data) => {
  try {
    localStorage.setItem(PLAN_STORAGE_PREFIX + planId, JSON.stringify(data));
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[usePlanManager] Error saving plan to storage:", error);
    }
    toast.warn("Could not save plan data. Storage may be full.", {
      toastId: "plan-save-error",
      autoClose: 8000,
    });
  }
};

const loadPlanFromStorage = (planId) => {
  try {
    const stored = localStorage.getItem(PLAN_STORAGE_PREFIX + planId);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[usePlanManager] Error loading plan from storage:", error);
    }
    return null;
  }
};

const removePlanFromStorage = (planId) => {
  try {
    localStorage.removeItem(PLAN_STORAGE_PREFIX + planId);
  } catch {
    // best-effort cleanup
  }
};

/**
 * Hook providing all plan management operations.
 * Uses useRecoilCallback for atomic read+write without extra subscriptions.
 */
const usePlanManager = () => {
  /**
   * Switch to a different plan:
   * 1. Save current atom data under outgoing plan's storage key
   * 2. Load target plan's data from storage (or use defaults)
   * 3. Write target data into the atom (atom effect persists to ACTIVE_PLAN_KEY)
   * 4. Update registry's activePlanId
   */
  const switchPlan = useRecoilCallback(
    ({ snapshot, set }) =>
      async (targetPlanId) => {
        const registry = await snapshot.getPromise(curriculumPlansRegistryState);
        if (targetPlanId === registry.activePlanId) return;
        if (!registry.plans[targetPlanId]) return;

        // Step 1: save current plan data to its dedicated storage key
        const currentData = await snapshot.getPromise(curriculumPlanState);
        savePlanToStorage(registry.activePlanId, currentData);

        // Step 2: load target plan data
        const targetData = loadPlanFromStorage(targetPlanId);

        // Step 3: swap atom contents
        if (targetData) {
          set(curriculumPlanState, targetData);
        } else {
          // First time switching to a plan that was just created (data is in ACTIVE_PLAN_KEY)
          // or the default plan on first migration — keep atom as-is if no stored data
          if (import.meta.env.DEV) {
            console.log(`[usePlanManager] No stored data for ${targetPlanId}, loading defaults`);
          }
          set(curriculumPlanState, {
            plannedItems: {},
            specialization: null,
            validations: { conflicts: [], categoryWarnings: [], availabilityWarnings: [] },
            syncStatus: { lastSynced: null, pendingChanges: [], syncError: null },
            lastModified: null,
          });
        }

        // Step 4: update registry
        const now = new Date().toISOString();
        set(curriculumPlansRegistryState, {
          ...registry,
          activePlanId: targetPlanId,
          plans: {
            ...registry.plans,
            [targetPlanId]: { ...registry.plans[targetPlanId], lastModified: now },
          },
        });
      },
    []
  );

  /**
   * Create a new plan by duplicating the current plan's data.
   * Automatically switches to the new plan.
   */
  const createPlan = useRecoilCallback(
    ({ snapshot, set }) =>
      async (name = "New Plan") => {
        const registry = await snapshot.getPromise(curriculumPlansRegistryState);
        const currentData = await snapshot.getPromise(curriculumPlanState);
        const newId = generatePlanId();
        const now = new Date().toISOString();

        // Save current plan data under its storage key before switching away
        savePlanToStorage(registry.activePlanId, currentData);

        // Save duplicated data under new plan's key, then load it into the atom
        const clonedData = JSON.parse(JSON.stringify(currentData));
        clonedData.lastModified = now;
        savePlanToStorage(newId, clonedData);
        set(curriculumPlanState, clonedData);

        // Update registry: add new plan and make it active
        set(curriculumPlansRegistryState, {
          ...registry,
          activePlanId: newId,
          plans: {
            ...registry.plans,
            [registry.activePlanId]: {
              ...registry.plans[registry.activePlanId],
              lastModified: now,
            },
            [newId]: { id: newId, name, createdAt: now, lastModified: now },
          },
        });

        return newId;
      },
    []
  );

  /**
   * Delete a plan. Cannot delete the last remaining plan.
   * If deleting the active plan, switches to the first available plan first.
   */
  const deletePlan = useRecoilCallback(
    ({ snapshot, set }) =>
      async (planId) => {
        const registry = await snapshot.getPromise(curriculumPlansRegistryState);
        const planIds = Object.keys(registry.plans);
        if (planIds.length <= 1) return;

        const removePlanEntry = (reg) =>
          Object.fromEntries(Object.entries(reg.plans).filter(([id]) => id !== planId));

        // If deleting the active plan, switch to another first
        if (planId === registry.activePlanId) {
          const otherPlanId = planIds.find((id) => id !== planId);
          await switchPlan(otherPlanId);
          const updatedRegistry = await snapshot.getPromise(curriculumPlansRegistryState);
          set(curriculumPlansRegistryState, { ...updatedRegistry, plans: removePlanEntry(updatedRegistry) });
        } else {
          set(curriculumPlansRegistryState, { ...registry, plans: removePlanEntry(registry) });
        }

        removePlanFromStorage(planId);
      },
    [switchPlan]
  );

  /**
   * Rename a plan in the registry.
   */
  const renamePlan = useRecoilCallback(
    ({ snapshot, set }) =>
      async (planId, newName) => {
        const registry = await snapshot.getPromise(curriculumPlansRegistryState);
        if (!registry.plans[planId]) return;

        set(curriculumPlansRegistryState, {
          ...registry,
          plans: {
            ...registry.plans,
            [planId]: {
              ...registry.plans[planId],
              name: newName,
              lastModified: new Date().toISOString(),
            },
          },
        });
      },
    []
  );

  /**
   * Duplicate a specific plan (can be active or inactive).
   * The duplicate becomes the new active plan.
   */
  const duplicatePlan = useRecoilCallback(
    ({ snapshot, set }) =>
      async (planId) => {
        const registry = await snapshot.getPromise(curriculumPlansRegistryState);
        if (!registry.plans[planId]) return;

        const currentData = await snapshot.getPromise(curriculumPlanState);
        const now = new Date().toISOString();
        const newId = generatePlanId();
        const sourceName = registry.plans[planId].name;

        // Save current active plan before switching
        savePlanToStorage(registry.activePlanId, currentData);

        // Get source data (either from atom if active, or from storage)
        let sourceData;
        if (planId === registry.activePlanId) {
          sourceData = currentData;
        } else {
          sourceData = loadPlanFromStorage(planId);
          if (!sourceData) {
            toast.error("Could not load plan data for duplication.", {
              toastId: "plan-duplicate-error",
            });
            return;
          }
        }

        const clonedData = JSON.parse(JSON.stringify(sourceData));
        clonedData.lastModified = now;
        savePlanToStorage(newId, clonedData);
        set(curriculumPlanState, clonedData);

        set(curriculumPlansRegistryState, {
          ...registry,
          activePlanId: newId,
          plans: {
            ...registry.plans,
            [registry.activePlanId]: {
              ...registry.plans[registry.activePlanId],
              lastModified: now,
            },
            [newId]: {
              id: newId,
              name: `${sourceName} (copy)`,
              createdAt: now,
              lastModified: now,
            },
          },
        });

        return newId;
      },
    []
  );

  return {
    switchPlan: useCallback((...args) => switchPlan(...args), [switchPlan]),
    createPlan: useCallback((...args) => createPlan(...args), [createPlan]),
    deletePlan: useCallback((...args) => deletePlan(...args), [deletePlan]),
    renamePlan: useCallback((...args) => renamePlan(...args), [renamePlan]),
    duplicatePlan: useCallback((...args) => duplicatePlan(...args), [duplicatePlan]),
  };
};

export default usePlanManager;
