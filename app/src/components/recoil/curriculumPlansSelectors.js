import { selector } from "recoil";
import { curriculumPlansRegistryState } from "./curriculumPlansRegistryAtom";

/**
 * Sorted list of plans with isActive flag, ordered by creation date.
 */
export const planListSelector = selector({
  key: "planListSelector",
  get: ({ get }) => {
    const registry = get(curriculumPlansRegistryState);
    return Object.values(registry.plans)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((plan) => ({
        ...plan,
        isActive: plan.id === registry.activePlanId,
      }));
  },
});

/**
 * Metadata of the currently active plan.
 */
export const activePlanMetadataSelector = selector({
  key: "activePlanMetadataSelector",
  get: ({ get }) => {
    const registry = get(curriculumPlansRegistryState);
    return registry.plans[registry.activePlanId] ?? null;
  },
});

