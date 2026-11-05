import { useRecoilCallback, useRecoilValue } from "recoil";
import { toast } from "react-toastify";
import { useDegradedMode } from "../common/useDegradedMode";
import {
  curriculumPlanState,
  getDefaultPlanState,
  generatePlaceholderId,
  isSemesterCompleted,
} from "../recoil/curriculumPlanAtom";
import {
  curriculumPlansRegistryState,
  generatePlanId,
} from "../recoil/curriculumPlansRegistryAtom";
import { authTokenState } from "../recoil/authAtom";
import { unifiedCourseDataState } from "../recoil/unifiedCourseDataAtom";
import {
  getCurriculumPlans,
  setActivePlanApi,
  upsertPlan,
  deletePlanApi,
  duplicatePlanApi,
  upsertPlacement,
  removePlacement,
  setSemesterNoteApi,
} from "./curriculumPlansApi";

// --- Conversion helpers ---

/**
 * Convert API placements array to plannedItems by semester
 */
const convertPlacementsToPlannedItems = (placements = []) => {
  const plannedItems = {};
  placements.forEach((p) => {
    if (!plannedItems[p.semester]) {
      plannedItems[p.semester] = [];
    }
    plannedItems[p.semester].push({
      type: p.type,
      ...(p.type === "course" && {
        courseId: p.courseId,
        shortName: p.shortName,
        label: p.label,
        credits: p.credits,
      }),
      ...(p.type === "placeholder" && {
        id: p.placementId,
        label: p.label,
        credits: p.credits,
      }),
      categoryPath: p.categoryPath,
      note: p.note,
      colorCode: p.colorCode,
      addedAt: p.addedAt,
    });
  });
  return plannedItems;
};

/**
 * Convert plannedItems by semester to flat placements array
 */
const convertPlannedItemsToPlacements = (plannedItems = {}) => {
  const placements = [];
  Object.entries(plannedItems).forEach(([semester, items]) => {
    items.forEach((item) => {
      placements.push({
        placementId:
          item.type === "placeholder" ? item.id : `course-${item.courseId}`,
        type: item.type,
        semester,
        categoryPath: item.categoryPath,
        ...(item.type === "course" && {
          courseId: item.courseId,
          shortName: item.shortName,
          credits: item.credits,
        }),
        ...(item.type === "placeholder" && {
          label: item.label,
          credits: item.credits,
        }),
        note: item.note,
        colorCode: item.colorCode,
        addedAt: item.addedAt,
      });
    });
  });
  return placements;
};

/**
 * Replace the local plannedItems with the active plan from a server response.
 */
const applyPlannedItems = (set, data) => {
  const activePlan = data.plans[data.activePlanId];
  if (activePlan) {
    set(curriculumPlanState, (prev) => ({
      ...prev,
      plannedItems: convertPlacementsToPlannedItems(activePlan.placements),
      lastModified: activePlan.lastModified,
    }));
  }
};

/**
 * Build a callback that runs `action({ planId, set }, ...args)` against the
 * active plan and resolves to its result. `token` keys the memo, so the
 * callback is rebuilt with a fresh `action` whenever the token changes. On failure it shows one toast
 * (none for a DegradedModeError: the degraded-mode banner covers that) and
 * resolves to `failureValue`.
 */
const useActivePlanAction = (
  token,
  action,
  { errorMessage, toastId, failureValue = false, requiresActivePlan = false },
) =>
  useRecoilCallback(
    ({ snapshot, set }) =>
      async (...args) => {
        const { activePlanId } = await snapshot.getPromise(
          curriculumPlansRegistryState,
        );
        if (requiresActivePlan && !activePlanId) return failureValue;

        try {
          return await action({ planId: activePlanId, set }, ...args);
        } catch (error) {
          if (error?.isDegradedModeError) return failureValue;
          console.error(`[usePlanManager] ${errorMessage}`, error);
          toast.error(errorMessage, { toastId });
          return failureValue;
        }
      },
    [token],
  );

/**
 * Hook providing all plan management operations via API.
 * Uses useRecoilCallback for atomic read+write without extra subscriptions.
 */
const usePlanManager = () => {
  const token = useRecoilValue(authTokenState);
  const { isDegradedMode } = useDegradedMode();

  /**
   * Load plans from API (call on CurriculumMap mount).
   * Server auto-creates a default plan on first access, so the response
   * is always populated.
   */
  const loadPlans = useRecoilCallback(
    ({ snapshot, set }) =>
      async () => {
        const registry = await snapshot.getPromise(
          curriculumPlansRegistryState,
        );

        // Skip if already loaded
        if (registry.isLoaded) return;

        // Degraded mode: SHSG API is disabled. Skip the fetch without
        // marking the registry isLoaded, so recovery (isDegradedMode
        // flipping off) can re-trigger a real load via the mount effect.
        if (isDegradedMode) return;

        try {
          const data = await getCurriculumPlans(token);

          const plans = {};
          Object.entries(data.plans).forEach(([planId, plan]) => {
            plans[planId] = {
              id: planId,
              name: plan.name,
              createdAt: plan.createdAt,
              lastModified: plan.lastModified,
            };
          });

          set(curriculumPlansRegistryState, {
            activePlanId: data.activePlanId,
            plans,
            schemaVersion: 1,
            isLoaded: true,
            isDirty: false,
          });

          const activePlan = data.plans[data.activePlanId];
          if (activePlan) {
            set(curriculumPlanState, {
              ...getDefaultPlanState(),
              plannedItems: convertPlacementsToPlannedItems(
                activePlan.placements,
              ),
              semesterNotes: activePlan.semesterNotes || {},
              wishlistOverrides: activePlan.wishlistOverrides || {},
              lastModified: activePlan.lastModified,
            });
          }
        } catch (error) {
          // The kill switch may have flipped ON between the isDegradedMode
          // check above and this request landing, in which case the
          // interceptor rejects with a DegradedModeError here instead. Bail
          // out silently (no toast) and leave isLoaded false so recovery
          // re-triggers a real load instead of getting stuck on an empty
          // registry.
          if (error?.isDegradedModeError) {
            return;
          }

          console.error("[usePlanManager] Error loading plans:", error);
          toast.error("Could not load your curriculum plans.", {
            toastId: "plans-load-error",
          });
          // Mark as loaded anyway to prevent infinite retry
          set(curriculumPlansRegistryState, (prev) => ({
            ...prev,
            isLoaded: true,
          }));
        }
      },
    [token, isDegradedMode],
  );

  /**
   * Switch to a different plan
   */
  const switchPlan = useRecoilCallback(
    ({ snapshot, set }) =>
      async (targetPlanId) => {
        const registry = await snapshot.getPromise(
          curriculumPlansRegistryState,
        );
        if (targetPlanId === registry.activePlanId) return;
        if (!registry.plans[targetPlanId]) return;

        try {
          // Save current plan first (including semesterNotes and wishlistOverrides)
          const currentData = await snapshot.getPromise(curriculumPlanState);
          await upsertPlan(
            registry.activePlanId,
            {
              placements: convertPlannedItemsToPlacements(
                currentData.plannedItems,
              ),
              semesterNotes: currentData.semesterNotes || {},
              wishlistOverrides: currentData.wishlistOverrides || {},
            },
            token,
          );

          // Switch active plan via API
          const data = await setActivePlanApi(targetPlanId, token);

          // Update local state with API response
          const targetPlan = data.plans[targetPlanId];
          set(curriculumPlanState, {
            ...getDefaultPlanState(),
            plannedItems: convertPlacementsToPlannedItems(
              targetPlan?.placements || [],
            ),
            semesterNotes: targetPlan?.semesterNotes || {},
            wishlistOverrides: targetPlan?.wishlistOverrides || {},
            lastModified: targetPlan?.lastModified,
          });

          set(curriculumPlansRegistryState, (prev) => ({
            ...prev,
            activePlanId: targetPlanId,
          }));
        } catch (error) {
          if (error?.isDegradedModeError) return;
          console.error("[usePlanManager] Error switching plan:", error);
          toast.error("Could not switch plans.", {
            toastId: "plan-switch-error",
          });
        }
      },
    [token],
  );

  /**
   * Create a new plan
   */
  const createPlan = useRecoilCallback(
    ({ snapshot, set }) =>
      async (name = "New Plan") => {
        const registry = await snapshot.getPromise(
          curriculumPlansRegistryState,
        );

        try {
          // Save current plan first
          const currentData = await snapshot.getPromise(curriculumPlanState);
          await upsertPlan(
            registry.activePlanId,
            {
              placements: convertPlannedItemsToPlacements(
                currentData.plannedItems,
              ),
              semesterNotes: currentData.semesterNotes || {},
              wishlistOverrides: currentData.wishlistOverrides || {},
            },
            token,
          );

          // Create new plan via API
          const newPlanId = generatePlanId();
          await upsertPlan(newPlanId, { name, placements: [] }, token);

          // Switch to new plan
          await setActivePlanApi(newPlanId, token);

          set(curriculumPlanState, getDefaultPlanState());
          set(curriculumPlansRegistryState, {
            ...registry,
            activePlanId: newPlanId,
            plans: {
              ...registry.plans,
              [newPlanId]: {
                id: newPlanId,
                name,
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
              },
            },
          });

          return newPlanId;
        } catch (error) {
          if (error?.isDegradedModeError) return;
          console.error("[usePlanManager] Error creating plan:", error);
          toast.error("Could not create plan.", {
            toastId: "plan-create-error",
          });
        }
      },
    [token],
  );

  /**
   * Duplicate a plan
   */
  const duplicatePlan = useRecoilCallback(
    ({ snapshot, set }) =>
      async (planId, name) => {
        const registry = await snapshot.getPromise(
          curriculumPlansRegistryState,
        );
        if (!registry.plans[planId]) return;

        try {
          // Save current plan first
          const currentData = await snapshot.getPromise(curriculumPlanState);
          await upsertPlan(
            registry.activePlanId,
            {
              placements: convertPlannedItemsToPlacements(
                currentData.plannedItems,
              ),
              semesterNotes: currentData.semesterNotes || {},
              wishlistOverrides: currentData.wishlistOverrides || {},
            },
            token,
          );

          const sourceName = registry.plans[planId].name;
          const data = await duplicatePlanApi(
            planId,
            name ?? `${sourceName} (copy)`,
            token,
          );

          // Find the new plan ID (the one that wasn't there before)
          const newPlanId = Object.keys(data.plans).find(
            (id) => !registry.plans[id],
          );

          if (newPlanId) {
            const newPlan = data.plans[newPlanId];
            set(curriculumPlanState, {
              ...getDefaultPlanState(),
              plannedItems: convertPlacementsToPlannedItems(newPlan.placements),
              semesterNotes: newPlan.semesterNotes || {},
              wishlistOverrides: newPlan.wishlistOverrides || {},
            });

            set(curriculumPlansRegistryState, {
              ...registry,
              activePlanId: newPlanId,
              plans: {
                ...registry.plans,
                [newPlanId]: {
                  id: newPlanId,
                  name: newPlan.name,
                  createdAt: newPlan.createdAt,
                  lastModified: newPlan.lastModified,
                },
              },
            });
          }

          return newPlanId;
        } catch (error) {
          if (error?.isDegradedModeError) return;
          console.error("[usePlanManager] Error duplicating plan:", error);
          toast.error("Could not duplicate plan.", {
            toastId: "plan-duplicate-error",
          });
        }
      },
    [token],
  );

  /**
   * Delete a plan. Cannot delete the last remaining plan.
   */
  const deletePlan = useRecoilCallback(
    ({ snapshot, set }) =>
      async (planId) => {
        const registry = await snapshot.getPromise(
          curriculumPlansRegistryState,
        );
        const planIds = Object.keys(registry.plans);
        if (planIds.length <= 1) return;

        try {
          const data = await deletePlanApi(planId, token);

          const remainingPlans = Object.fromEntries(
            Object.entries(registry.plans).filter(([id]) => id !== planId),
          );

          // If we deleted the active plan, switch to the new active from API response
          if (planId === registry.activePlanId) {
            const newActivePlan = data.plans[data.activePlanId];
            set(curriculumPlanState, {
              ...getDefaultPlanState(),
              plannedItems: convertPlacementsToPlannedItems(
                newActivePlan?.placements || [],
              ),
              semesterNotes: newActivePlan?.semesterNotes || {},
              wishlistOverrides: newActivePlan?.wishlistOverrides || {},
            });
          }

          set(curriculumPlansRegistryState, {
            ...registry,
            activePlanId: data.activePlanId,
            plans: remainingPlans,
          });
        } catch (error) {
          if (error?.isDegradedModeError) return;
          console.error("[usePlanManager] Error deleting plan:", error);
          toast.error("Could not delete plan.", {
            toastId: "plan-delete-error",
          });
        }
      },
    [token],
  );

  /**
   * Rename a plan
   */
  const renamePlan = useRecoilCallback(
    ({ snapshot, set }) =>
      async (planId, newName) => {
        const registry = await snapshot.getPromise(
          curriculumPlansRegistryState,
        );
        if (!registry.plans[planId]) return;

        try {
          await upsertPlan(planId, { name: newName }, token);

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
        } catch (error) {
          if (error?.isDegradedModeError) return;
          console.error("[usePlanManager] Error renaming plan:", error);
          toast.error("Could not rename plan.", {
            toastId: "plan-rename-error",
          });
        }
      },
    [token],
  );

  /**
   * Add a course directly via API (granular operation).
   * State is updated from API response - API is the source of truth.
   *
   * @param {string} courseId - Course ID
   * @param {string} semesterKey - Target semester (e.g., "FS26")
   * @param {string} categoryPath - Category path (e.g., "Core/Required")
   * @param {string} [shortName] - Course short name
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  const addCourseById = useActivePlanAction(
    token,
    async (
      { planId, set },
      courseId,
      semesterKey,
      categoryPath,
      shortName = null,
      credits = null,
    ) => {
      const data = await upsertPlacement(
        planId,
        `course-${courseId}`,
        {
          type: "course",
          semester: semesterKey,
          categoryPath,
          courseId,
          ...(shortName && { shortName }),
          ...(credits != null && { credits }),
          addedAt: new Date().toISOString(),
        },
        token,
      );
      applyPlannedItems(set, data);
      return true;
    },
    { errorMessage: "Could not add course.", toastId: "course-add-error" },
  );

  /**
   * Remove a course directly via API (granular operation).
   * State is updated from API response - API is the source of truth.
   *
   * @param {string} courseId - Course ID to remove
   * @returns {Promise<boolean>} - Whether removal was successful
   */
  const removeCourseById = useActivePlanAction(
    token,
    async ({ planId, set }, courseId) => {
      const data = await removePlacement(planId, `course-${courseId}`, token);
      applyPlannedItems(set, data);
      return true;
    },
    { errorMessage: "Could not remove course.", toastId: "course-remove-error" },
  );

  /**
   * Update a placement's position (move operation) via API.
   * Works for both courses and placeholders.
   * State is updated from API response - API is the source of truth.
   *
   * @param {string} placementId - Placement ID to update
   * @param {string} toSemester - Target semester
   * @param {string} toCategoryPath - Target category path
   * @param {Object} [extraData] - Additional data to include (type, courseId, shortName, etc.)
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  const updatePlacementById = useActivePlanAction(
    token,
    async (
      { planId, set },
      placementId,
      toSemester,
      toCategoryPath,
      extraData = {},
    ) => {
      const data = await upsertPlacement(
        planId,
        placementId,
        { ...extraData, semester: toSemester, categoryPath: toCategoryPath },
        token,
      );
      applyPlannedItems(set, data);
      return true;
    },
    { errorMessage: "Could not move item.", toastId: "placement-update-error" },
  );

  /**
   * Add a placeholder directly via API (granular operation).
   * State is updated from API response - API is the source of truth.
   *
   * @param {string} semesterKey - Target semester (e.g., "FS26")
   * @param {string} categoryPath - Category path (e.g., "Core/Required")
   * @param {number} credits - Credit value for placeholder
   * @param {string} label - Display label (default "TBD")
   * @param {string} [placeholderId] - Optional ID, auto-generated if not provided
   * @returns {Promise<string|null>} - The placeholder ID or null on failure
   */
  const addPlaceholderById = useActivePlanAction(
    token,
    async (
      { planId, set },
      semesterKey,
      categoryPath,
      credits,
      label = "TBD",
      placeholderId = null,
    ) => {
      const id = placeholderId || generatePlaceholderId();
      const data = await upsertPlacement(
        planId,
        id,
        {
          type: "placeholder",
          semester: semesterKey,
          categoryPath,
          credits,
          label,
          addedAt: new Date().toISOString(),
        },
        token,
      );
      applyPlannedItems(set, data);
      return id;
    },
    {
      errorMessage: "Could not add placeholder.",
      toastId: "placeholder-add-error",
      failureValue: null,
    },
  );

  /**
   * Remove a placeholder directly via API (granular operation).
   * State is updated from API response - API is the source of truth.
   *
   * @param {string} placeholderId - The placeholder ID to remove
   * @returns {Promise<boolean>} - Whether removal was successful
   */
  const removePlaceholderById = useActivePlanAction(
    token,
    async ({ planId, set }, placeholderId) => {
      const data = await removePlacement(planId, placeholderId, token);
      applyPlannedItems(set, data);
      return true;
    },
    {
      errorMessage: "Could not remove placeholder.",
      toastId: "placeholder-remove-error",
    },
  );

  /**
   * Import selected courses from the study plan into the curriculum plan.
   * Reads selected courses from unifiedCourseDataState and creates placements via API.
   * Only imports courses from non-completed semesters.
   *
   * @returns {Promise<{imported: number, skipped: number}>} - Count of imported and skipped courses
   */
  const importSelectedCourses = useRecoilCallback(
    ({ snapshot, set }) =>
      async () => {
        const registry = await snapshot.getPromise(
          curriculumPlansRegistryState,
        );
        const unifiedCourseData = await snapshot.getPromise(
          unifiedCourseDataState,
        );
        const currentPlan = await snapshot.getPromise(curriculumPlanState);

        if (!registry.activePlanId) {
          toast.error("No active plan selected.", {
            toastId: "import-no-plan",
          });
          return { imported: 0, skipped: 0 };
        }

        const semesters = unifiedCourseData.semesters || {};
        let imported = 0;
        let skipped = 0;

        // Collect all courses to import
        const coursesToImport = [];

        for (const [semesterKey, semesterData] of Object.entries(semesters)) {
          // Skip completed semesters
          if (isSemesterCompleted(semesterKey)) {
            continue;
          }

          const selectedIds = semesterData.selectedIds || [];
          const availableCourses = semesterData.available || [];

          // Get full course objects for selected IDs
          for (const courseId of selectedIds) {
            const course = availableCourses.find(
              (c) => c.courseNumber === courseId || c.id === courseId,
            );

            if (course) {
              // Check if already in curriculum plan
              const existingItems = currentPlan.plannedItems[semesterKey] || [];
              const alreadyExists = existingItems.some(
                (item) =>
                  item.courseId === courseId ||
                  item.courseId === course.courseNumber,
              );

              if (alreadyExists) {
                skipped++;
                continue;
              }

              coursesToImport.push({
                courseId: course.courseNumber || course.id,
                semesterKey,
                shortName: course.shortName || course.name,
                classification: course.classification,
                credits: course.credits,
              });
            }
          }
        }

        if (coursesToImport.length === 0) {
          toast.info("No new courses to import.", { toastId: "import-empty" });
          return { imported: 0, skipped };
        }

        // Build merged placements array: existing + new imports (single API call)
        const toastId = toast.loading(
          `Importing ${coursesToImport.length} courses...`,
        );

        try {
          const existingPlacements = convertPlannedItemsToPlacements(
            currentPlan.plannedItems,
          );

          const newPlacements = coursesToImport.map((course) => ({
            placementId: `course-${course.courseId}`,
            type: "course",
            semester: course.semesterKey,
            categoryPath: course.classification || "Uncategorized",
            courseId: course.courseId,
            shortName: course.shortName,
            ...(course.credits != null && { credits: course.credits }),
            addedAt: new Date().toISOString(),
          }));

          const mergedPlacements = [...existingPlacements, ...newPlacements];
          imported = coursesToImport.length;

          const data = await upsertPlan(
            registry.activePlanId,
            {
              placements: mergedPlacements,
              semesterNotes: currentPlan.semesterNotes || {},
            },
            token,
          );

          applyPlannedItems(set, data);

          toast.update(toastId, {
            render: `Imported ${imported} course${imported !== 1 ? "s" : ""} successfully!`,
            type: "success",
            isLoading: false,
            autoClose: 3000,
          });

          return { imported, skipped };
        } catch (error) {
          if (error?.isDegradedModeError) {
            toast.dismiss(toastId);
            return { imported: 0, skipped };
          }
          console.error("[usePlanManager] Error importing courses:", error);
          toast.update(toastId, {
            render: "Failed to import courses.",
            type: "error",
            isLoading: false,
            autoClose: 3000,
          });
          return { imported: 0, skipped };
        }
      },
    [token],
  );

  /**
   * Set or clear a semester note via API
   * @param {string} semesterKey - Semester key (e.g., "FS26")
   * @param {string} note - Note text (empty to clear)
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  const setSemesterNoteById = useActivePlanAction(
    token,
    async ({ planId, set }, semesterKey, note) => {
      const trimmedNote = (note || "").trim().slice(0, 200);
      const data = await setSemesterNoteApi(
        planId,
        semesterKey,
        trimmedNote || null,
        token,
      );

      const activePlan = data.plans[data.activePlanId];
      if (activePlan) {
        set(curriculumPlanState, (prev) => ({
          ...prev,
          semesterNotes: activePlan.semesterNotes || {},
          lastModified: activePlan.lastModified,
        }));
      }
      return true;
    },
    {
      errorMessage: "Could not save semester note.",
      toastId: "semester-note-error",
      requiresActivePlan: true,
    },
  );

  const updateWishlistOverridesById = useActivePlanAction(
    token,
    async ({ planId, set }, wishlistOverrides) => {
      await upsertPlan(planId, { wishlistOverrides }, token);
      set(curriculumPlanState, (prev) => ({ ...prev, wishlistOverrides }));
      return true;
    },
    {
      errorMessage: "Could not update course visibility.",
      toastId: "wishlist-override-error",
      requiresActivePlan: true,
    },
  );

  /**
   * Atomically sync the full active plan's placements and notes to the API.
   *
   * @param {Object} plannedItems - The full plannedItems object (by semester)
   * @param {Object} [semesterNotes] - Optional semester notes to sync
   * @returns {Promise<boolean>} - Whether the sync was successful
   */
  const syncActivePlan = useActivePlanAction(
    token,
    async ({ planId, set }, plannedItems, semesterNotes) => {
      const data = await upsertPlan(
        planId,
        {
          placements: convertPlannedItemsToPlacements(plannedItems),
          ...(semesterNotes !== undefined && { semesterNotes }),
        },
        token,
      );
      applyPlannedItems(set, data);
      return true;
    },
    {
      errorMessage: "Could not save changes.",
      toastId: "plan-sync-error",
      requiresActivePlan: true,
    },
  );

  return {
    loadPlans,
    switchPlan,
    createPlan,
    deletePlan,
    renamePlan,
    duplicatePlan,
    addPlaceholderById,
    removePlaceholderById,
    addCourseById,
    removeCourseById,
    updatePlacementById,
    importSelectedCourses,
    setSemesterNoteById,
    updateWishlistOverridesById,
    syncActivePlan,
  };
};

export default usePlanManager;
