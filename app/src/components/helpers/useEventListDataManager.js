/**
 * useEventListDataManager Hook - SIMPLIFIED VERSION
 *
 * Simplified hook that manages data fetching for EventListContainer.
 * This version removes legacy atom dependencies and focuses only on unified course data.
 *
 * REMOVED DEPENDENCIES:
 * - localSelectedCoursesSemKeyState (replaced with unified selected courses)
 * - allCourseInfoState (replaced with unified available courses)
 * - Legacy index-based systems (replaced with semantic semester names)
 * - useUpdateEnrolledCoursesAtom (replaced with unified course data)
 *
 * NEW SIMPLIFIED FLOW:
 * 1. Receive termListObject from useTermSelection (contains {cisId, shortName, isCurrent, isProjected})
 * 2. Fetch and update ONLY unifiedCourseDataAtom
 * 3. Use selectors to get filtered courses for display
 * 4. Remove intermediate state management
 */

import { useState, useEffect } from "react";
import { useRecoilValue } from "recoil";
import { selectionOptionsState } from "../recoil/selectionOptionsAtom";
import { selectedCourseIdsAtom } from "../recoil/selectedCourseIdsAtom";
import { useUnifiedCourseData } from "./useUnifiedCourseData";
import { useEnrolledCoursesData } from "./useEnrolledCoursesData";
import { useCourseInfoData } from "./useCourseInfoData";
import { useCourseRatingsData } from "./useCourseRatingsData";
import { useStudyPlanDataSimplified } from "./useStudyPlanDataSimplified";

/**
 * Simplified hook for managing EventListContainer data
 *
 * @param {Object} params - Hook parameters
 * @param {string} params.authToken - Authentication token
 * @param {Object} params.selectedSemester - Current selected semester from termListObject
 *   Structure: {cisId, shortName, isCurrent, isProjected}
 * @returns {Object} Simplified data states and loading status
 */
export const useEventListDataManager = ({ authToken, selectedSemester }) => {
  // Recoil state - simplified, only what's needed
  const selectionOptions = useRecoilValue(selectionOptionsState);
  const selectedCourseIds = useRecoilValue(selectedCourseIdsAtom);

  // Local state - simplified
  const [isLoading, setIsLoading] = useState(true);

  // Unified course data hook - this is now our single source of truth
  const {
    initializeSemester: initializeUnifiedSemester,
    updateFilteredCourses: updateUnifiedFilteredCourses,
  } = useUnifiedCourseData();

  // Individual data hooks - these now update unified data directly
  const { isEnrolledCoursesLoading } = useEnrolledCoursesData({
    authToken,
    selectedSemester,
  });

  const { isCourseDataLoading } = useCourseInfoData({
    authToken,
    selectedSemester,
  });

  const { isStudyPlanLoading } = useStudyPlanDataSimplified({
    authToken,
    selectedSemester,
  });

  const { isCourseRatingsLoading } = useCourseRatingsData({ authToken });

  // Initialize unified semester data for the current semester
  useEffect(() => {
    if (selectedSemester?.shortName) {
      console.log(
        `🔄 [SIMPLIFIED] Initializing unified semester data for: ${selectedSemester.shortName}`
      );

      // Initialize with all metadata from termListObject
      initializeUnifiedSemester(selectedSemester.shortName, {
        cisId: selectedSemester.cisId,
        isCurrent: selectedSemester.isCurrent,
        isProjected: selectedSemester.isProjected,
        isFutureSemester: selectedSemester.isProjected, // isProjected implies future semester
        referenceSemester: selectedSemester.isProjected
          ? // For projected semesters, we'll need to determine reference semester
            // This can be done by finding the latest valid term from unified state
            null
          : null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedSemester?.shortName,
    selectedSemester?.cisId,
    selectedSemester?.isCurrent,
    selectedSemester?.isProjected,
  ]);

  // Update filtered courses when selection options or selected courses change
  // AND when available courses are loaded
  useEffect(() => {
    if (selectedSemester?.shortName) {
      console.log(
        `🔄 [SIMPLIFIED] Updating filtered courses for ${selectedSemester.shortName}`
      );
      console.log(
        `🔍 [DEBUG] selectedCourseIds in useEventListDataManager:`,
        selectedCourseIds
      );

      // Update filtered courses using unified system
      // Pass empty objects as defaults to ensure filtering happens even without selection options
      updateUnifiedFilteredCourses(
        selectedSemester.shortName,
        selectionOptions || {},
        selectedCourseIds || []
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedSemester?.shortName,
    selectionOptions,
    selectedCourseIds,
    isCourseDataLoading, // Re-run when course data finishes loading
    isStudyPlanLoading, // Re-run when study plan finishes loading
  ]);

  // Specific effect to update filtered courses when data loading completes
  useEffect(() => {
    if (
      selectedSemester?.shortName &&
      !isCourseDataLoading &&
      !isEnrolledCoursesLoading &&
      !isStudyPlanLoading
    ) {
      console.log(
        `🔄 [SIMPLIFIED] Data loading complete - refreshing filtered courses for ${selectedSemester.shortName}`
      );

      // Force update filtered courses after all data is loaded
      updateUnifiedFilteredCourses(
        selectedSemester.shortName,
        selectionOptions || {},
        selectedCourseIds || []
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedSemester?.shortName,
    isCourseDataLoading,
    isEnrolledCoursesLoading,
    isStudyPlanLoading,
  ]);

  // Update overall loading state
  useEffect(() => {
    const newIsLoading =
      isEnrolledCoursesLoading ||
      isCourseDataLoading ||
      isStudyPlanLoading ||
      isCourseRatingsLoading;

    if (newIsLoading !== isLoading) {
      console.log(
        `⏳ [SIMPLIFIED] Overall loading state changed: ${
          newIsLoading ? "Loading..." : "Complete"
        }`
      );
      setIsLoading(newIsLoading);
    }
  }, [
    isEnrolledCoursesLoading,
    isCourseDataLoading,
    isStudyPlanLoading,
    isCourseRatingsLoading,
    isLoading,
  ]);

  return {
    // Simplified return - only essential loading state
    // Course data now comes directly from unified selectors in components
    isLoading,
    isEnrolledCoursesLoading,
    isCourseDataLoading,
    isStudyPlanLoading,
    isCourseRatingsLoading,
  };
};

export default useEventListDataManager;
