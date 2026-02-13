import { useCallback } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import {
  curriculumPlanState,
  getNextSemesterKey,
  getCurrentSemesterInfo,
  isSemesterSyncable as checkSemesterSyncable,
  isSemesterCompleted as checkSemesterCompleted,
} from "../recoil/curriculumPlanAtom";
import { localSelectedCoursesSemKeyState } from "../recoil/localSelectedCoursesSemKeyAtom";
import { unifiedCourseDataState } from "../recoil/unifiedCourseDataAtom";
import { useUnifiedCourseData } from "./useUnifiedCourseData";
import usePlanManager from "./usePlanManager";

/**
 * Check if a stored course matches a given courseId.
 * Handles inconsistent ID field usage across the codebase.
 */
const courseMatchesId = (storedCourse, courseId) => {
  if (!storedCourse || !courseId) return false;
  const storedId = storedCourse.id || storedCourse.courseNumber || storedCourse.courseId;
  return storedId === courseId;
};

/**
 * useCurriculumPlan Hook
 *
 * Manages curriculum plan state operations for the Curriculum Map.
 * Handles the distinction between:
 * - Current/next semester: Updates localSelectedCoursesSemKeyState (syncs to backend)
 * - Future semesters: Updates curriculumPlanState via API
 *
 * Key operations:
 * - moveCourse: Move a course between semester/category cells
 * - addCourse: Add a course from CoursePicker to the grid
 * - removeCourse: Remove a course from the plan
 */
export const useCurriculumPlan = () => {
  const [curriculumPlan] = useRecoilState(curriculumPlanState);
  const [, setLocalSelectedCourses] = useRecoilState(
    localSelectedCoursesSemKeyState
  );
  const unifiedCourseData = useRecoilValue(unifiedCourseDataState);
  const { removeSelectedCourse } = useUnifiedCourseData();
  const { 
    addPlaceholderById, 
    removePlaceholderById,
    addCourseById,
    removeCourseById,
    updatePlacementById,
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
   * For future semesters, uses API directly.
   *
   * @param {string} courseId - The course ID to move
   * @param {string} fromSemester - Source semester key
   * @param {string} toSemester - Target semester key
   * @param {string} toCategoryPath - Target category path
   * @param {string} source - Where the course came from ("wishlist" | "plan")
   * @returns {Promise<boolean>} - Whether the move was successful
   */
  const moveCourse = useCallback(
    async (courseId, fromSemester, toSemester, toCategoryPath, source) => {
      // Prevent moves to completed semesters
      if (isSemesterCompleted(toSemester)) {
        if (import.meta.env.DEV) {
          console.warn("[useCurriculumPlan] Cannot move to completed semester");
        }
        return false;
      }

      const toIsSyncable = isSemesterSyncable(toSemester);
      const fromIsSyncable = isSemesterSyncable(fromSemester);
      const isSameSemester = fromSemester === toSemester;

      // Get full course data for enrichment
      const availableCourses =
        unifiedCourseData.semesters?.[fromSemester]?.available || [];
      const courseData = availableCourses.find(
        (c) => c.courseNumber === courseId || c.id === courseId
      );

      // Same-semester category move: just update categoryPath
      if (isSameSemester) {
        if (source === "wishlist" || fromIsSyncable) {
          setLocalSelectedCourses((prev) => {
            const semesterCourses = prev[fromSemester] || [];
            return {
              ...prev,
              [fromSemester]: semesterCourses.map((c) =>
                courseMatchesId(c, courseId)
                  ? { ...c, categoryPath: toCategoryPath }
                  : c
              ),
            };
          });
        } else {
          // Future semester - update via API
          await updatePlacementById(`course-${courseId}`, toSemester, toCategoryPath, {
            type: "course",
            courseId,
            shortName: courseData?.shortName,
          });
        }
        return true;
      }

      // Cross-semester move: remove from source and add to destination
      // Remove from source
      if (source === "wishlist" || fromIsSyncable) {
        setLocalSelectedCourses((prev) => {
          const semesterCourses = prev[fromSemester] || [];
          return {
            ...prev,
            [fromSemester]: semesterCourses.filter(
              (c) => !courseMatchesId(c, courseId)
            ),
          };
        });
      } else {
        // Remove from future semester via API
        await removeCourseById(courseId);
      }

      // Add to destination
      if (toIsSyncable) {
        // Add to wishlist (localSelectedCoursesSemKey)
        setLocalSelectedCourses((prev) => {
          const semesterCourses = prev[toSemester] || [];
          // Avoid duplicates using normalized ID matching
          if (semesterCourses.some((c) => courseMatchesId(c, courseId))) {
            return prev;
          }
          return {
            ...prev,
            [toSemester]: [
              ...semesterCourses,
              {
                id: courseId,
                courseNumber: courseId,
                shortName: courseData?.shortName || courseId,
                credits: courseData?.credits,
                classification: courseData?.classification,
                calendarEntry: courseData?.calendarEntry,
                categoryPath: toCategoryPath,
              },
            ],
          };
        });
      } else {
        // Add to future semester via API
        await addCourseById(courseId, toSemester, toCategoryPath, courseData?.shortName);
      }

      return true;
    },
    [
      isSemesterCompleted,
      isSemesterSyncable,
      unifiedCourseData,
      setLocalSelectedCourses,
      updatePlacementById,
      removeCourseById,
      addCourseById,
    ]
  );

  /**
   * Add a course from CoursePicker to the grid
   * For future semesters, uses API directly.
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
      const isSyncable = isSemesterSyncable(semesterKey);

      if (isSyncable) {
        // Add to shared wishlist
        setLocalSelectedCourses((prev) => {
          const semesterCourses = prev[semesterKey] || [];
          // Avoid duplicates using normalized ID matching
          if (semesterCourses.some((c) => courseMatchesId(c, courseId))) {
            return prev;
          }
          return {
            ...prev,
            [semesterKey]: [
              ...semesterCourses,
              {
                id: courseId,
                courseNumber: courseId,
                shortName: course.shortName,
                credits: course.credits,
                classification: course.classification,
                calendarEntry: course.calendarEntry,
                categoryPath: categoryPath,
              },
            ],
          };
        });
      } else {
        // Check for duplicates in local state
        const existingItems = curriculumPlan.plannedItems[semesterKey] || [];
        if (existingItems.some((item) => item.courseId === courseId)) {
          return false;
        }
        // Add to future semester via API
        await addCourseById(courseId, semesterKey, categoryPath, course.shortName);
      }

      return true;
    },
    [isSemesterCompleted, isSemesterSyncable, setLocalSelectedCourses, curriculumPlan, addCourseById]
  );

  /**
   * Remove a course from the plan
   * For future semesters, uses API directly.
   *
   * @param {string} courseId - The course ID to remove
   * @param {string} semesterKey - The semester to remove from
   * @param {string} source - Where the course is ("wishlist" | "plan")
   * @returns {Promise<boolean>} - Whether the removal was successful
   */
  const removeCourse = useCallback(
    async (courseId, semesterKey, source) => {
      if (isSemesterSyncable(semesterKey)) {
        // Remove from shared wishlist state
        setLocalSelectedCourses((prev) => ({
          ...prev,
          [semesterKey]: (prev[semesterKey] || []).filter(
            (c) => !courseMatchesId(c, courseId)
          ),
        }));
        removeSelectedCourse(semesterKey, courseId);
      } else {
        // Future semester — remove via API
        await removeCourseById(courseId);
      }

      return true;
    },
    [isSemesterSyncable, setLocalSelectedCourses, removeSelectedCourse, removeCourseById]
  );

  /**
   * Add a new semester to the plan (for future planning)
   * Note: Empty semesters are created locally but will be persisted when items are added.
   *
   * @param {string} lastSemesterKey - The last semester currently in the grid
   * @returns {string} - The newly added semester key
   */
  const addSemester = useCallback(
    (lastSemesterKey) => {
      const newSemesterKey = getNextSemesterKey(lastSemesterKey);
      // Note: The semester will appear in the grid once items are added via API
      return newSemesterKey;
    },
    []
  );

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
          console.warn("[useCurriculumPlan] Cannot add placeholder to completed semester");
        }
        return null;
      }

      // Call API directly - state updated from response
      return addPlaceholderById(semesterKey, categoryPath, credits, label);
    },
    [isSemesterCompleted, addPlaceholderById]
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
          console.warn("[useCurriculumPlan] Cannot move placeholder to completed semester");
        }
        return false;
      }

      // Find the placeholder data from current state
      const sourceItems = curriculumPlan.plannedItems[fromSemester] || [];
      const placeholder = sourceItems.find((item) => item.id === placeholderId);

      if (!placeholder) {
        console.warn("[useCurriculumPlan] Placeholder not found:", placeholderId);
        return false;
      }

      // Update via API - includes semester, categoryPath, and placeholder data
      return updatePlacementById(placeholderId, toSemester, toCategoryPath, {
        type: "placeholder",
        label: placeholder.label,
        credits: placeholder.credits,
      });
    },
    [isSemesterCompleted, curriculumPlan, updatePlacementById]
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
    [removePlaceholderById]
  );

  return {
    moveCourse,
    addCourse,
    removeCourse,
    addSemester,
    addPlaceholder,
    movePlaceholder,
    removePlaceholder,
    isSemesterSyncable,
    isSemesterCompleted,
    getCurrentSemesterKey,
  };
};

export default useCurriculumPlan;
