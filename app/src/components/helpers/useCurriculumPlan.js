import { useCallback } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import {
  curriculumPlanState,
  createCoursePlanItem,
  createPlaceholderItem,
  getNextSemesterKey,
  getCurrentSemesterInfo,
  isSemesterSyncable as checkSemesterSyncable,
  isSemesterCompleted as checkSemesterCompleted,
} from "../recoil/curriculumPlanAtom";
import { localSelectedCoursesSemKeyState } from "../recoil/localSelectedCoursesSemKeyAtom";
import { unifiedCourseDataState } from "../recoil/unifiedCourseDataAtom";
import { useUnifiedCourseData } from "./useUnifiedCourseData";

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
 * - Future semesters: Updates curriculumPlanState (local-only)
 *
 * Key operations:
 * - moveCourse: Move a course between semester/category cells
 * - addCourse: Add a course from CoursePicker to the grid
 * - removeCourse: Remove a course from the plan
 */
export const useCurriculumPlan = () => {
  const [, setCurriculumPlan] = useRecoilState(curriculumPlanState);
  const [, setLocalSelectedCourses] = useRecoilState(
    localSelectedCoursesSemKeyState
  );
  const unifiedCourseData = useRecoilValue(unifiedCourseDataState);
  const { removeSelectedCourse } = useUnifiedCourseData();

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
   *
   * @param {string} courseId - The course ID to move
   * @param {string} fromSemester - Source semester key
   * @param {string} toSemester - Target semester key
   * @param {string} toCategoryPath - Target category path
   * @param {string} source - Where the course came from ("wishlist" | "plan")
   * @returns {boolean} - Whether the move was successful
   */
  const moveCourse = useCallback(
    (courseId, fromSemester, toSemester, toCategoryPath, source) => {
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
          setCurriculumPlan((prev) => ({
            ...prev,
            plannedItems: {
              ...prev.plannedItems,
              [fromSemester]: (prev.plannedItems[fromSemester] || []).map(
                (item) =>
                  item.courseId === courseId
                    ? { ...item, categoryPath: toCategoryPath }
                    : item
              ),
            },
          }));
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
        // Remove from curriculum plan
        setCurriculumPlan((prev) => ({
          ...prev,
          plannedItems: {
            ...prev.plannedItems,
            [fromSemester]: (prev.plannedItems[fromSemester] || []).filter(
              (item) => item.courseId !== courseId
            ),
          },
        }));
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
                categoryPath: toCategoryPath, // Store category path for correct grid placement
              },
            ],
          };
        });
      } else {
        // Add to curriculum plan
        setCurriculumPlan((prev) => ({
          ...prev,
          plannedItems: {
            ...prev.plannedItems,
            [toSemester]: [
              ...(prev.plannedItems[toSemester] || []),
              createCoursePlanItem(courseId, toCategoryPath, courseData?.shortName),
            ],
          },
        }));
      }

      return true;
    },
    [
      isSemesterCompleted,
      isSemesterSyncable,
      unifiedCourseData,
      setLocalSelectedCourses,
      setCurriculumPlan,
    ]
  );

  /**
   * Add a course from CoursePicker to the grid
   *
   * @param {object} course - The course object from available courses
   * @param {string} semesterKey - Target semester key
   * @param {string} categoryPath - Target category path
   * @returns {boolean} - Whether the add was successful
   */
  const addCourse = useCallback(
    (course, semesterKey, categoryPath) => {
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
        // Add to wishlist
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
                categoryPath: categoryPath, // Store category path for correct grid placement
              },
            ],
          };
        });
      } else {
        // Add to curriculum plan
        setCurriculumPlan((prev) => {
          const existingItems = prev.plannedItems[semesterKey] || [];
          // Avoid duplicates
          if (existingItems.some((item) => item.courseId === courseId)) {
            return prev;
          }
          return {
            ...prev,
            plannedItems: {
              ...prev.plannedItems,
              [semesterKey]: [
                ...existingItems,
                createCoursePlanItem(courseId, categoryPath, course.shortName),
              ],
            },
          };
        });
      }

      return true;
    },
    [isSemesterCompleted, isSemesterSyncable, setLocalSelectedCourses, setCurriculumPlan]
  );

  /**
   * Remove a course from the plan
   *
   * @param {string} courseId - The course ID to remove
   * @param {string} semesterKey - The semester to remove from
   * @param {string} source - Where the course is ("wishlist" | "plan")
   * @returns {boolean} - Whether the removal was successful
   */
  const removeCourse = useCallback(
    (courseId, semesterKey, source) => {
      if (source === "wishlist" || isSemesterSyncable(semesterKey)) {
        setLocalSelectedCourses((prev) => ({
          ...prev,
          [semesterKey]: (prev[semesterKey] || []).filter(
            (c) => !courseMatchesId(c, courseId)
          ),
        }));

        // Keep unified state in sync so EventListContainer reflects the removal
        removeSelectedCourse(semesterKey, courseId);
      } else {
        setCurriculumPlan((prev) => ({
          ...prev,
          plannedItems: {
            ...prev.plannedItems,
            [semesterKey]: (prev.plannedItems[semesterKey] || []).filter(
              (item) => item.courseId !== courseId
            ),
          },
        }));
      }

      return true;
    },
    [isSemesterSyncable, setLocalSelectedCourses, setCurriculumPlan, removeSelectedCourse]
  );

  /**
   * Add a new semester to the plan (for future planning)
   * Creates an empty semester entry that will appear in the grid
   *
   * @param {string} lastSemesterKey - The last semester currently in the grid
   * @returns {string} - The newly added semester key
   */
  const addSemester = useCallback(
    (lastSemesterKey) => {
      const newSemesterKey = getNextSemesterKey(lastSemesterKey);

      // Add empty entry to curriculum plan to make it appear in the grid
      setCurriculumPlan((prev) => {
        // Don't add if already exists
        if (prev.plannedItems[newSemesterKey]) {
          return prev;
        }
        return {
          ...prev,
          plannedItems: {
            ...prev.plannedItems,
            [newSemesterKey]: [], // Empty array - will show in grid
          },
        };
      });

      return newSemesterKey;
    },
    [setCurriculumPlan]
  );

  /**
   * Add a placeholder item to a future semester cell
   * Placeholders represent generic credit allocations without specific courses
   *
   * @param {string} semesterKey - Target semester key
   * @param {string} categoryPath - Target category path
   * @param {number} credits - Number of credits for the placeholder
   * @param {string} label - Display label (defaults to "TBD")
   * @returns {boolean} - Whether the add was successful
   */
  const addPlaceholder = useCallback(
    (semesterKey, categoryPath, credits, label = "TBD") => {
      if (isSemesterCompleted(semesterKey)) {
        if (import.meta.env.DEV) {
          console.warn("[useCurriculumPlan] Cannot add placeholder to completed semester");
        }
        return false;
      }

      // Placeholders only go to curriculum plan (not wishlist sync)
      setCurriculumPlan((prev) => ({
        ...prev,
        plannedItems: {
          ...prev.plannedItems,
          [semesterKey]: [
            ...(prev.plannedItems[semesterKey] || []),
            createPlaceholderItem(categoryPath, credits, label),
          ],
        },
      }));

      return true;
    },
    [isSemesterCompleted, setCurriculumPlan]
  );

  /**
   * Move a placeholder item between cells
   *
   * @param {string} placeholderId - The placeholder ID to move
   * @param {string} fromSemester - Source semester key
   * @param {string} toSemester - Target semester key
   * @param {string} toCategoryPath - Target category path
   * @returns {boolean} - Whether the move was successful
   */
  const movePlaceholder = useCallback(
    (placeholderId, fromSemester, toSemester, toCategoryPath) => {
      if (isSemesterCompleted(toSemester)) {
        if (import.meta.env.DEV) {
          console.warn("[useCurriculumPlan] Cannot move placeholder to completed semester");
        }
        return false;
      }

      const isSameSemester = fromSemester === toSemester;

      setCurriculumPlan((prev) => {
        const sourceItems = prev.plannedItems[fromSemester] || [];
        const placeholder = sourceItems.find((item) => item.id === placeholderId);

        if (!placeholder) return prev;

        if (isSameSemester) {
          // Same-semester: update categoryPath in place
          return {
            ...prev,
            plannedItems: {
              ...prev.plannedItems,
              [fromSemester]: sourceItems.map((item) =>
                item.id === placeholderId
                  ? { ...item, categoryPath: toCategoryPath }
                  : item
              ),
            },
          };
        }

        // Cross-semester: remove from source, add to destination
        const destItems = prev.plannedItems[toSemester] || [];
        return {
          ...prev,
          plannedItems: {
            ...prev.plannedItems,
            [fromSemester]: sourceItems.filter((item) => item.id !== placeholderId),
            [toSemester]: [...destItems, { ...placeholder, categoryPath: toCategoryPath }],
          },
        };
      });

      return true;
    },
    [isSemesterCompleted, setCurriculumPlan]
  );

  /**
   * Remove a placeholder item from the plan
   *
   * @param {string} placeholderId - The placeholder ID to remove
   * @param {string} semesterKey - The semester to remove from
   * @returns {boolean} - Whether the removal was successful
   */
  const removePlaceholder = useCallback(
    (placeholderId, semesterKey) => {
      setCurriculumPlan((prev) => ({
        ...prev,
        plannedItems: {
          ...prev.plannedItems,
          [semesterKey]: (prev.plannedItems[semesterKey] || []).filter(
            (item) => item.id !== placeholderId
          ),
        },
      }));

      return true;
    },
    [setCurriculumPlan]
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
