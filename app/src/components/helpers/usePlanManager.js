import { useRecoilCallback, useRecoilValue } from "recoil";
import { toast } from "react-toastify";
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
 * Hook providing all plan management operations via API.
 * Uses useRecoilCallback for atomic read+write without extra subscriptions.
 */
const usePlanManager = () => {
  const token = useRecoilValue(authTokenState);

  /**
   * Load plans from API (call on CurriculumMap mount)
   * If 404 (new user), uses default state and sets isNewUser flag.
   * Data only syncs to server when user makes actual changes.
   */
  const loadPlans = useRecoilCallback(
    ({ snapshot, set }) =>
      async () => {
        const registry = await snapshot.getPromise(
          curriculumPlansRegistryState,
        );

        // Skip if already loaded
        if (registry.isLoaded) return;

        try {
          const data = await getCurriculumPlans(token);

          if (data === null) {
            // New user - no saved plans on server
            // Use default state, mark as new user (will sync on first change)
            console.log("[usePlanManager] New user, using default plan state");
            set(curriculumPlansRegistryState, (prev) => ({
              ...prev,
              isLoaded: true,
              isNewUser: true,
              isDirty: false,
            }));
            // curriculumPlanState already has defaults
            return;
          }

          // Existing user - load from server
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
            isNewUser: false,
            isDirty: false,
          });

          // Load active plan data into curriculumPlanState
          const activePlan = data.plans[data.activePlanId];
          if (activePlan) {
            set(curriculumPlanState, {
              ...getDefaultPlanState(),
              plannedItems: convertPlacementsToPlannedItems(
                activePlan.placements,
              ),
              semesterNotes: activePlan.semesterNotes || {},
              lastModified: activePlan.lastModified,
            });
          }
        } catch (error) {
          console.error("[usePlanManager] Error loading plans:", error);
          toast.error("Could not load your curriculum plans.", {
            toastId: "plans-load-error",
          });
          // Mark as loaded anyway to prevent infinite retry, treat as new user
          set(curriculumPlansRegistryState, (prev) => ({
            ...prev,
            isLoaded: true,
            isNewUser: true,
          }));
        }
      },
    [token],
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
          // Save current plan first (including semesterNotes)
          const currentData = await snapshot.getPromise(curriculumPlanState);
          await upsertPlan(
            registry.activePlanId,
            {
              placements: convertPlannedItemsToPlacements(
                currentData.plannedItems,
              ),
              semesterNotes: currentData.semesterNotes || {},
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
            lastModified: targetPlan?.lastModified,
          });

          set(curriculumPlansRegistryState, (prev) => ({
            ...prev,
            activePlanId: targetPlanId,
          }));
        } catch (error) {
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
            });
          }

          set(curriculumPlansRegistryState, {
            ...registry,
            activePlanId: data.activePlanId,
            plans: remainingPlans,
          });
        } catch (error) {
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
  const addCourseById = useRecoilCallback(
    ({ snapshot, set }) =>
      async (courseId, semesterKey, categoryPath, shortName = null) => {
        const registry = await snapshot.getPromise(
          curriculumPlansRegistryState,
        );
        const placementId = `course-${courseId}`;

        const placementData = {
          type: "course",
          semester: semesterKey,
          categoryPath,
          courseId,
          ...(shortName && { shortName }),
          addedAt: new Date().toISOString(),
        };

        try {
          const data = await upsertPlacement(
            registry.activePlanId,
            placementId,
            placementData,
            token,
          );

          const activePlan = data.plans[data.activePlanId];
          if (activePlan) {
            set(curriculumPlanState, (prev) => ({
              ...prev,
              plannedItems: convertPlacementsToPlannedItems(
                activePlan.placements,
              ),
              lastModified: activePlan.lastModified,
            }));
          }

          set(curriculumPlansRegistryState, (prev) => ({
            ...prev,
            isNewUser: false,
          }));

          return true;
        } catch (error) {
          console.error("[usePlanManager] Error adding course:", error);
          toast.error("Could not add course.", { toastId: "course-add-error" });
          return false;
        }
      },
    [token],
  );

  /**
   * Remove a course directly via API (granular operation).
   * State is updated from API response - API is the source of truth.
   *
   * @param {string} courseId - Course ID to remove
   * @returns {Promise<boolean>} - Whether removal was successful
   */
  const removeCourseById = useRecoilCallback(
    ({ snapshot, set }) =>
      async (courseId) => {
        const registry = await snapshot.getPromise(
          curriculumPlansRegistryState,
        );
        const placementId = `course-${courseId}`;

        try {
          const data = await removePlacement(
            registry.activePlanId,
            placementId,
            token,
          );

          const activePlan = data.plans[data.activePlanId];
          if (activePlan) {
            set(curriculumPlanState, (prev) => ({
              ...prev,
              plannedItems: convertPlacementsToPlannedItems(
                activePlan.placements,
              ),
              lastModified: activePlan.lastModified,
            }));
          }

          return true;
        } catch (error) {
          console.error("[usePlanManager] Error removing course:", error);
          toast.error("Could not remove course.", {
            toastId: "course-remove-error",
          });
          return false;
        }
      },
    [token],
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
  const updatePlacementById = useRecoilCallback(
    ({ snapshot, set }) =>
      async (placementId, toSemester, toCategoryPath, extraData = {}) => {
        const registry = await snapshot.getPromise(
          curriculumPlansRegistryState,
        );

        const placementData = {
          ...extraData,
          semester: toSemester,
          categoryPath: toCategoryPath,
        };

        try {
          const data = await upsertPlacement(
            registry.activePlanId,
            placementId,
            placementData,
            token,
          );

          const activePlan = data.plans[data.activePlanId];
          if (activePlan) {
            set(curriculumPlanState, (prev) => ({
              ...prev,
              plannedItems: convertPlacementsToPlannedItems(
                activePlan.placements,
              ),
              lastModified: activePlan.lastModified,
            }));
          }

          return true;
        } catch (error) {
          console.error("[usePlanManager] Error updating placement:", error);
          toast.error("Could not move item.", {
            toastId: "placement-update-error",
          });
          return false;
        }
      },
    [token],
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
  const addPlaceholderById = useRecoilCallback(
    ({ snapshot, set }) =>
      async (
        semesterKey,
        categoryPath,
        credits,
        label = "TBD",
        placeholderId = null,
      ) => {
        const registry = await snapshot.getPromise(
          curriculumPlansRegistryState,
        );
        const id = placeholderId || generatePlaceholderId();

        const placementData = {
          type: "placeholder",
          semester: semesterKey,
          categoryPath,
          credits,
          label,
          addedAt: new Date().toISOString(),
        };

        try {
          // API call - response is source of truth
          const data = await upsertPlacement(
            registry.activePlanId,
            id,
            placementData,
            token,
          );

          // Update state from API response
          const activePlan = data.plans[data.activePlanId];
          if (activePlan) {
            set(curriculumPlanState, (prev) => ({
              ...prev,
              plannedItems: convertPlacementsToPlannedItems(
                activePlan.placements,
              ),
              lastModified: activePlan.lastModified,
            }));
          }

          set(curriculumPlansRegistryState, (prev) => ({
            ...prev,
            isNewUser: false,
          }));

          return id;
        } catch (error) {
          console.error("[usePlanManager] Error adding placeholder:", error);
          toast.error("Could not add placeholder.", {
            toastId: "placeholder-add-error",
          });
          return null;
        }
      },
    [token],
  );

  /**
   * Remove a placeholder directly via API (granular operation).
   * State is updated from API response - API is the source of truth.
   *
   * @param {string} placeholderId - The placeholder ID to remove
   * @returns {Promise<boolean>} - Whether removal was successful
   */
  const removePlaceholderById = useRecoilCallback(
    ({ snapshot, set }) =>
      async (placeholderId) => {
        const registry = await snapshot.getPromise(
          curriculumPlansRegistryState,
        );

        try {
          // API call - response is source of truth
          const data = await removePlacement(
            registry.activePlanId,
            placeholderId,
            token,
          );

          // Update state from API response
          const activePlan = data.plans[data.activePlanId];
          if (activePlan) {
            set(curriculumPlanState, (prev) => ({
              ...prev,
              plannedItems: convertPlacementsToPlannedItems(
                activePlan.placements,
              ),
              lastModified: activePlan.lastModified,
            }));
          }

          return true;
        } catch (error) {
          console.error("[usePlanManager] Error removing placeholder:", error);
          toast.error("Could not remove placeholder.", {
            toastId: "placeholder-remove-error",
          });
          return false;
        }
      },
    [token],
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

          const activePlan = data.plans[data.activePlanId];
          if (activePlan) {
            set(curriculumPlanState, (prev) => ({
              ...prev,
              plannedItems: convertPlacementsToPlannedItems(
                activePlan.placements,
              ),
              lastModified: activePlan.lastModified,
            }));
          }

          toast.update(toastId, {
            render: `Imported ${imported} course${imported !== 1 ? "s" : ""} successfully!`,
            type: "success",
            isLoading: false,
            autoClose: 3000,
          });

          return { imported, skipped };
        } catch (error) {
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
  const setSemesterNoteById = useRecoilCallback(
    ({ snapshot, set }) =>
      async (semesterKey, note) => {
        const registry = await snapshot.getPromise(
          curriculumPlansRegistryState,
        );

        if (!registry.activePlanId) {
          return false;
        }

        const trimmedNote = (note || "").trim().slice(0, 200);

        try {
          const data = await setSemesterNoteApi(
            registry.activePlanId,
            semesterKey,
            trimmedNote || null,
            token,
          );

          // Update local state with API response
          const activePlan = data.plans[data.activePlanId];
          if (activePlan) {
            set(curriculumPlanState, (prev) => ({
              ...prev,
              semesterNotes: activePlan.semesterNotes || {},
              lastModified: activePlan.lastModified,
            }));
          }

          return true;
        } catch (error) {
          console.error("[usePlanManager] Error setting semester note:", error);
          toast.error("Could not save semester note.", {
            toastId: "semester-note-error",
          });
          return false;
        }
      },
    [token],
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
  };
};

export default usePlanManager;
