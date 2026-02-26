import { useCallback } from "react";
import { useRecoilValue } from "recoil";
import {
  curriculumPlanState,
  getNextSemesterKey,
  getCurrentSemesterInfo,
  isSemesterSyncable as checkSemesterSyncable,
  isSemesterCompleted as checkSemesterCompleted,
} from "../recoil/curriculumPlanAtom";
import { unifiedCourseDataState } from "../recoil/unifiedCourseDataAtom";
import usePlanManager from "./usePlanManager";

/**
 * useCurriculumPlan Hook
 *
 * Manages curriculum plan state operations for the Curriculum Map.
 * All operations persist to the curriculum-plans API immediately.
 *
 * Key operations:
 * - moveCourse: Move a course between semester/category cells
 * - addCourse: Add a course from CoursePicker to the grid
 * - removeCourse: Remove a course from the plan
 */
export const useCurriculumPlan = () => {
  const curriculumPlan = useRecoilValue(curriculumPlanState);
  const unifiedCourseData = useRecoilValue(unifiedCourseDataState);
  const {
    addPlaceholderById,
    removePlaceholderById,
    addCourseById,
    removeCourseById,
    updatePlacementById,
    setSemesterNoteById,
  } = usePlanManager();

  /**
   * Determine if a semester is "current or next" (eligible for wishlist sync)
   * vs "future" (local plan only)
   */
  const isSemesterSyncable = useCallback((semesterKey) => {
    return checkSemesterSyncable(semesterKey);
  }, []);

  /**
   * Get the current semester key
   */
  const getCurrentSemesterKey = useCallback(() => {
    return getCurrentSemesterInfo().currentSemKey;
  }, []);

  /**
   * Check if a semester is in the past (completed)
   */
  const isSemesterCompleted = useCallback((semesterKey) => {
    return checkSemesterCompleted(semesterKey);
  }, []);

  /**
   * Move a course from one cell to another
   * Always persists to curriculum-plans API.
   *
   * @param {string} courseId - The course ID to move
   * @param {string} fromSemester - Source semester key
   * @param {string} toSemester - Target semester key
   * @param {string} toCategoryPath - Target category path
   * @returns {Promise<boolean>} - Whether the move was successful
   */
  const moveCourse = useCallback(
    async (courseId, fromSemester, toSemester, toCategoryPath) => {
      // Prevent moves to completed semesters
      if (isSemesterCompleted(toSemester)) {
        if (import.meta.env.DEV) {
          console.warn("[useCurriculumPlan] Cannot move to completed semester");
        }
        return false;
      }

      const isSameSemester = fromSemester === toSemester;

      // Get full course data for enrichment
      const availableCourses =
        unifiedCourseData.semesters?.[fromSemester]?.available || [];
      const courseData = availableCourses.find(
        (c) => c.courseNumber === courseId || c.id === courseId,
      );

      // Same-semester category move: just update categoryPath via API
      if (isSameSemester) {
        await updatePlacementById(
          `course-${courseId}`,
          toSemester,
          toCategoryPath,
          {
            type: "course",
            courseId,
            shortName: courseData?.shortName,
          },
        );
        return true;
      }

      // Cross-semester move: remove from source and add to destination via API
      await removeCourseById(courseId);
      await addCourseById(
        courseId,
        toSemester,
        toCategoryPath,
        courseData?.shortName,
      );

      return true;
    },
    [
      isSemesterCompleted,
      unifiedCourseData,
      updatePlacementById,
      removeCourseById,
      addCourseById,
    ],
  );

  /**
   * Add a course from CoursePicker to the grid
   * Always persists to API immediately.
   *
   * @param {object} course - The course object from available courses
   * @param {string} semesterKey - Target semester key
   * @param {string} categoryPath - Target category path
   * @returns {Promise<boolean>} - Whether the add was successful
   */
  const addCourse = useCallback(
    async (course, semesterKey, categoryPath) => {
      // Prevent adds to completed semesters
      if (isSemesterCompleted(semesterKey)) {
        if (import.meta.env.DEV) {
          console.warn("[useCurriculumPlan] Cannot add to completed semester");
        }
        return false;
      }

      const courseId = course.courseNumber || course.id;

      // Check for duplicates in local state
      const existingItems = curriculumPlan.plannedItems[semesterKey] || [];
      if (existingItems.some((item) => item.courseId === courseId)) {
        return false;
      }

      // Always persist to API immediately
      await addCourseById(
        courseId,
        semesterKey,
        categoryPath,
        course.shortName,
      );

      return true;
    },
    [isSemesterCompleted, curriculumPlan, addCourseById],
  );

  /**
   * Remove a course from the plan
   * Always removes via curriculum-plans API.
   *
   * @param {string} courseId - The course ID to remove
   * @param {string} semesterKey - The semester to remove from (unused, kept for API compatibility)
   * @returns {Promise<boolean>} - Whether the removal was successful
   */
  const removeCourse = useCallback(
    async (courseId) => {
      // Always remove via curriculum-plans API
      await removeCourseById(courseId);
      return true;
    },
    [removeCourseById],
  );

  /**
   * Add a new semester to the plan (for future planning)
   * Note: Empty semesters are created locally but will be persisted when items are added.
   *
   * @param {string} lastSemesterKey - The last semester currently in the grid
   * @returns {string} - The newly added semester key
   */
  const addSemester = useCallback((lastSemesterKey) => {
    const newSemesterKey = getNextSemesterKey(lastSemesterKey);
    // Note: The semester will appear in the grid once items are added via API
    return newSemesterKey;
  }, []);

  /**
   * Add a placeholder item to a future semester cell
   * Placeholders represent generic credit allocations without specific courses
   * Calls API directly - API is the source of truth.
   *
   * @param {string} semesterKey - Target semester key
   * @param {string} categoryPath - Target category path
   * @param {number} credits - Number of credits for the placeholder
   * @param {string} label - Display label (defaults to "TBD")
   * @returns {Promise<string|null>} - The placeholder ID or null on failure
   */
  const addPlaceholder = useCallback(
    async (semesterKey, categoryPath, credits, label = "TBD") => {
      if (isSemesterCompleted(semesterKey)) {
        if (import.meta.env.DEV) {
          console.warn(
            "[useCurriculumPlan] Cannot add placeholder to completed semester",
          );
        }
        return null;
      }

      // Call API directly - state updated from response
      return addPlaceholderById(semesterKey, categoryPath, credits, label);
    },
    [isSemesterCompleted, addPlaceholderById],
  );

  /**
   * Move a placeholder item between cells
   *
   * @param {string} placeholderId - The placeholder ID to move
   * @param {string} fromSemester - Source semester key
   * @param {string} toSemester - Target semester key
   * @param {string} toCategoryPath - Target category path
   * @returns {Promise<boolean>} - Whether the move was successful
   */
  const movePlaceholder = useCallback(
    async (placeholderId, fromSemester, toSemester, toCategoryPath) => {
      if (isSemesterCompleted(toSemester)) {
        if (import.meta.env.DEV) {
          console.warn(
            "[useCurriculumPlan] Cannot move placeholder to completed semester",
          );
        }
        return false;
      }

      // Find the placeholder data from current state
      const sourceItems = curriculumPlan.plannedItems[fromSemester] || [];
      const placeholder = sourceItems.find((item) => item.id === placeholderId);

      if (!placeholder) {
        console.warn(
          "[useCurriculumPlan] Placeholder not found:",
          placeholderId,
        );
        return false;
      }

      // Update via API - includes semester, categoryPath, and placeholder data
      return updatePlacementById(placeholderId, toSemester, toCategoryPath, {
        type: "placeholder",
        label: placeholder.label,
        credits: placeholder.credits,
      });
    },
    [isSemesterCompleted, curriculumPlan, updatePlacementById],
  );

  /**
   * Remove a placeholder item from the plan
   * Calls API directly - API is the source of truth.
   *
   * @param {string} placeholderId - The placeholder ID to remove
   * @returns {Promise<boolean>} - Whether the removal was successful
   */
  const removePlaceholder = useCallback(
    async (placeholderId) => {
      // Call API directly - state updated from response
      return removePlaceholderById(placeholderId);
    },
    [removePlaceholderById],
  );

  /**
   * Set or clear a free-text note for a semester.
   * Trims whitespace, caps at 200 characters, and removes the key when empty.
   * Persists to the API via setSemesterNoteById.
   */
  const setSemesterNote = useCallback(
    async (semesterKey, text) => {
      await setSemesterNoteById(semesterKey, text);
    },
    [setSemesterNoteById],
  );

  /**
   * Update placement attributes (note, colorCode, label, credits)
   * Persists to API immediately.
   *
   * @param {object} item - The planned item to update
   * @param {string} semesterKey - The semester key
   * @param {object} updates - Object with fields to update (note?, colorCode?, label?, credits?)
   * @returns {Promise<boolean>} - Whether the update was successful
   */
  const updatePlacementAttributes = useCallback(
    async (item, semesterKey, updates) => {
      const placementId = item.isPlaceholder
        ? item.id
        : `course-${item.courseId || item.id}`;

      // Build extraData based on item type, merging updates with existing values
      const extraData = {
        type: item.isPlaceholder ? "placeholder" : "course",
      };

      if (item.isPlaceholder) {
        // For placeholders: include label and credits (required by backend)
        extraData.label =
          updates.label !== undefined
            ? updates.label
            : item.label || item.name || "TBD";
        extraData.credits =
          updates.credits !== undefined ? updates.credits : item.credits || 3;
      } else {
        // For courses: include courseId and shortName
        extraData.courseId = item.courseId || item.id;
        extraData.shortName = item.shortName || item.name;
      }

      // Include note and colorCode (apply updates or preserve existing)
      extraData.note = updates.note !== undefined ? updates.note : item.note;
      extraData.colorCode =
        updates.colorCode !== undefined ? updates.colorCode : item.colorCode;

      // Clean up null/undefined values that should be removed
      if (extraData.note === null || extraData.note === "") {
        extraData.note = undefined;
      }
      if (extraData.colorCode === null || extraData.colorCode === "") {
        extraData.colorCode = undefined;
      }

      return updatePlacementById(
        placementId,
        semesterKey,
        item.categoryPath,
        extraData,
      );
    },
    [updatePlacementById],
  );

  return {
    moveCourse,
    addCourse,
    removeCourse,
    addSemester,
    addPlaceholder,
    movePlaceholder,
    removePlaceholder,
    setSemesterNote,
    updatePlacementAttributes,
    isSemesterSyncable,
    isSemesterCompleted,
    getCurrentSemesterKey,
  };
};

export default useCurriculumPlan;
