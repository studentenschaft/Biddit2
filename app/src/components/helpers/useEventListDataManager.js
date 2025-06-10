/**
 * useEventListDataManager Hook
 *
 * Master hook that orchestrates all data fetching and state management for EventListContainer.
 * This hook consolidates and coordinates all the individual data hooks to provide a single
 * interface for the main component.
 *
 * Responsibilities:
 * - Coordinate study plan, enrolled courses, course info, and ratings data
 * - Manage overall loading states
 * - Handle unified course data integration
 * - Manage local state updates (completeCourseInfo, filteredCourses)
 * - Bridge legacy and unified systems during migration
 *
 * Flow:
 * 1. Initialize unified semester data
 * 2. Fetch study plan data
 * 3. Fetch enrolled courses, course info, and ratings in parallel
 * 4. Update local states when data is available
 * 5. Integrate with unified filtered courses system
 * 6. Manage overall loading state
 */

import { useState, useEffect } from "react";
import { useRecoilValue } from "recoil";
import { allCourseInfoState } from "../recoil/allCourseInfosSelector";
import { selectionOptionsState } from "../recoil/selectionOptionsAtom";
import { selectedCourseIdsAtom } from "../recoil/selectedCourseIdsAtom";
import { useUnifiedCourseData } from "./useUnifiedCourseData";
import { useStudyPlanData } from "./useStudyPlanData";
import { useEnrolledCoursesData } from "./useEnrolledCoursesData";
import { useCourseInfoData } from "./useCourseInfoData";
import { useCourseRatingsData } from "./useCourseRatingsData";

/**
 * Master hook for managing all EventListContainer data
 *
 * @param {Object} params - Hook parameters
 * @param {string} params.authToken - Authentication token
 * @param {Object} params.selectedSemesterState - Current selected semester state
 * @param {number} params.index - Semester index for legacy system
 * @param {string} params.cisId - Course Information System ID for the semester
 * @returns {Object} All data states and loading status
 */
export const useEventListDataManager = ({
  authToken,
  selectedSemesterState,
  index,
  cisId,
}) => {
  // Recoil state
  const allCourseInfo = useRecoilValue(allCourseInfoState);
  const selectionOptions = useRecoilValue(selectionOptionsState);
  const selectedCourseIds = useRecoilValue(selectedCourseIdsAtom);
  // Local state
  const [completeCourseInfo, setCompleteCourseInfo] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Unified course data hook
  const {
    initializeSemester: initializeUnifiedSemester,
    updateAvailableCourses: updateUnifiedAvailableCourses,
    updateFilteredCourses: updateUnifiedFilteredCourses,
  } = useUnifiedCourseData();

  // Individual data hooks
  const studyPlanData = useStudyPlanData({
    authToken,
    selectedSemesterState,
    index,
  });
  const { isEnrolledCoursesLoading } = useEnrolledCoursesData({
    authToken,
    selectedSemesterState,
    index,
  });
  const { isCourseDataLoading } = useCourseInfoData({
    authToken,
    cisId,
    index,
    selectedSemesterState,
  });
  const { isCourseRatingsLoading } = useCourseRatingsData({ authToken });

  // Initialize unified semester data for the current semester
  useEffect(() => {
    if (selectedSemesterState?.shortName) {
      console.log(
        `🔄 Initializing unified semester data for: ${selectedSemesterState.shortName}`
      );
      initializeUnifiedSemester(selectedSemesterState.shortName);
    }
  }, [selectedSemesterState?.shortName, initializeUnifiedSemester]);

  // Update completeCourseInfo when allCourseInfo changes
  useEffect(() => {
    if (allCourseInfo && allCourseInfo[index]) {
      if (allCourseInfo[index].length > 0) {
        console.log(
          `📊 Updating complete course info for index ${index}: ${allCourseInfo[index].length} courses`
        );
        setCompleteCourseInfo(allCourseInfo[index]);
      }
    }
  }, [allCourseInfo, index]);
  // Integrate unified filtered courses system alongside legacy system
  useEffect(() => {
    // Only run if we have the necessary data
    if (selectedSemesterState?.shortName && completeCourseInfo?.length > 0) {
      try {
        console.log(
          `🔄 Updating unified course data for ${selectedSemesterState.shortName}`
        );

        // Initialize the semester if needed
        initializeUnifiedSemester(selectedSemesterState.shortName);

        // Update available courses first (these are the courses to be filtered)
        updateUnifiedAvailableCourses(
          selectedSemesterState.shortName,
          completeCourseInfo
        );

        // Update filtered courses using the selection options and selected course IDs
        updateUnifiedFilteredCourses(
          selectedSemesterState.shortName,
          selectionOptions,
          selectedCourseIds || []
        );

        console.log(
          `✅ Updated unified filtered courses for ${selectedSemesterState.shortName}`
        );
      } catch (error) {
        console.error("❌ Error updating unified filtered courses:", error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedSemesterState?.shortName,
    completeCourseInfo,
    selectionOptions,
    selectedCourseIds,
  ]);

  // Update overall loading state
  useEffect(() => {
    const newIsLoading =
      isEnrolledCoursesLoading || isCourseDataLoading || isCourseRatingsLoading;

    if (newIsLoading !== isLoading) {
      console.log(
        `⏳ Overall loading state changed: ${
          newIsLoading ? "Loading..." : "Complete"
        }`
      );
      setIsLoading(newIsLoading);
    }
  }, [
    isEnrolledCoursesLoading,
    isCourseDataLoading,
    isCourseRatingsLoading,
    isLoading,
  ]);
  return {
    // Data states
    completeCourseInfo,
    // NOTE: filteredCourses now comes directly from courseSelectors in components

    // Loading states
    isLoading,
    isEnrolledCoursesLoading,
    isCourseDataLoading,
    isCourseRatingsLoading,

    // Study plan data
    currentStudyPlan: studyPlanData.currentStudyPlan,
    hasSetLocalSelectedCourses: studyPlanData.hasSetLocalSelectedCourses,
    setHasSetLocalSelectedCourses: studyPlanData.setHasSetLocalSelectedCourses,
  };
};

export default useEventListDataManager;
