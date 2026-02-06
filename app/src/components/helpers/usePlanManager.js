import { useRecoilCallback } from "recoil";
import { toast } from "react-toastify";
import {
  curriculumPlanState,
  getDefaultPlanState,
} from "../recoil/curriculumPlanAtom";
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
          if (import.meta.env.DEV) {
            console.log(`[usePlanManager] No stored data for ${targetPlanId}, loading defaults`);
          }
          set(curriculumPlanState, getDefaultPlanState());
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
   * Duplicate a specific plan (can be active or inactive).
   * The duplicate becomes the new active plan.
   * @param {string} planId - ID of the plan to duplicate
   * @param {string} [name] - Name for the new plan (defaults to "${sourceName} (copy)")
   */
  const duplicatePlan = useRecoilCallback(
    ({ snapshot, set }) =>
      async (planId, name) => {
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
              name: name ?? `${sourceName} (copy)`,
              createdAt: now,
              lastModified: now,
            },
          },
        });

        return newId;
      },
    []
  );

  /**
   * Create a new plan by duplicating the active plan's data.
   * Delegates to duplicatePlan with an explicit name.
   */
  const createPlan = useRecoilCallback(
    ({ snapshot }) =>
      async (name = "New Plan") => {
        const registry = await snapshot.getPromise(curriculumPlansRegistryState);
        return duplicatePlan(registry.activePlanId, name);
      },
    [duplicatePlan]
  );

  /**
   * Delete a plan. Cannot delete the last remaining plan.
   * If deleting the active plan, atomically switches to another plan
   * in the same callback to avoid stale snapshot issues.
   */
  const deletePlan = useRecoilCallback(
    ({ snapshot, set }) =>
      async (planId) => {
        const registry = await snapshot.getPromise(curriculumPlansRegistryState);
        const planIds = Object.keys(registry.plans);
        if (planIds.length <= 1) return;

        const remainingPlans = Object.fromEntries(
          Object.entries(registry.plans).filter(([id]) => id !== planId)
        );

        if (planId === registry.activePlanId) {
          // Deleting the active plan: save current, load another, update registry — all in one batch
          const currentData = await snapshot.getPromise(curriculumPlanState);
          savePlanToStorage(registry.activePlanId, currentData);

          const otherPlanId = planIds.find((id) => id !== planId);
          const targetData = loadPlanFromStorage(otherPlanId);

          set(curriculumPlanState, targetData ?? getDefaultPlanState());

          const now = new Date().toISOString();
          set(curriculumPlansRegistryState, {
            activePlanId: otherPlanId,
            plans: {
              ...remainingPlans,
              [otherPlanId]: { ...remainingPlans[otherPlanId], lastModified: now },
            },
          });
        } else {
          set(curriculumPlansRegistryState, { ...registry, plans: remainingPlans });
        }

        removePlanFromStorage(planId);
      },
    []
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

  return { switchPlan, createPlan, deletePlan, renamePlan, duplicatePlan };
};

export default usePlanManager;
