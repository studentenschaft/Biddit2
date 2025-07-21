/**
 * useStudyPlanDataSi/**
 * Simplified hook for managing study plan dataPLIFIED VERSION
 *
 * Manages study plan fetching and updates selected courses in unified data.
 * This simplified version removes legacy atom dependencies and focuses only on unified course data.
 *
 * SIMPLIFIED CHANGES:
 * - Removes legacy localSelectedCoursesState and localSelectedCoursesSemKeyState
 * - Updates only unifiedCourseDataAtom for selected courses
 * - Uses simplified semester structure from termListObject
 * - Removes index-based logic
 *
 * Flow:
 * 1. Fetch study plans from SHSG API
 * 2. Find study plan for current semester using semester ID
 * 3. Update unified selected courses directly
 * 4. No more legacy atom updates
 */

import { useState, useEffect } from "react";
import axios from "axios";
import { useUnifiedCourseData } from "./useUnifiedCourseData";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

/**
 * Simplified hook for managing study plan data
 *
 * @param {Object} params - Hook parameters
 * @param {string} params.authToken - Authentication token
 * @param {Object} params.selectedSemester - Current selected semester from termListObject
 *   Structure: {cisId, id, shortName, isCurrent, isProjected}
 * @returns {Object} Study plan state and loading status
 */
export const useStudyPlanDataSimplified = ({ authToken, selectedSemester }) => {
  // Unified course data hook - no more legacy atoms
  const {
    updateSelectedCourses: updateUnifiedSelectedCourses,
    updateStudyPlan,
  } = useUnifiedCourseData();

  // Local loading state
  const [isStudyPlanLoading, setIsStudyPlanLoading] = useState(true);

  // Fetch study plan effect
  useEffect(() => {
    const fetchStudyPlan = async () => {
      // Only fetch if we have required data
      if (!selectedSemester?.id || !selectedSemester?.shortName) {
        setIsStudyPlanLoading(false);
        return;
      }

      setIsStudyPlanLoading(true);

      try {
        console.log(
          `🔄 [SIMPLIFIED] Fetching study plan for semester: ${selectedSemester.shortName} (ID: ${selectedSemester.id})`
        );

        const response = await axios.get("https://api.shsg.ch/study-plans", {
          headers: {
            "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
            "X-RequestedLanguage": "EN",
            "API-Version": "1",
            Authorization: `Bearer ${authToken}`,
          },
        });

        const studyPlansData = response.data;

        console.log("🔍 [DEBUG] Study plans raw data:", studyPlansData);
        console.log(
          `🔍 [DEBUG] Looking for semester: ${selectedSemester.shortName}`
        );

        // Get courses directly for the current semester using shortName (e.g., "HS25", "FS26")
        const currentSemesterCourses =
          studyPlansData[selectedSemester.shortName] || [];

        console.log(
          `🔍 [DEBUG] Found ${currentSemesterCourses.length} courses for ${selectedSemester.shortName}:`,
          currentSemesterCourses
        );

        if (currentSemesterCourses.length > 0) {
          console.log(
            `✅ [SIMPLIFIED] Found study plan for ${selectedSemester.shortName} with ${currentSemesterCourses.length} selected courses`
          );

          // The course numbers are already in the correct format (strings like "7,048,1.00")
          const extractedCourseNumbers = currentSemesterCourses;

          // Update BOTH the study plan raw data AND the unified selected courses
          // Store raw study plan data for filtering logic (these are the string course numbers)
          updateStudyPlan(selectedSemester.shortName, currentSemesterCourses);

          // Update unified selected courses (legacy selected field)
          updateUnifiedSelectedCourses(
            selectedSemester.shortName,
            extractedCourseNumbers
          );

          console.log(
            "✅ [SIMPLIFIED] Updated unified selected courses with:",
            extractedCourseNumbers
          );
        } else {
          console.log(
            `⚠️ [SIMPLIFIED] No study plan found for semester ${selectedSemester.shortName} (ID: ${selectedSemester.id})`
          );

          // Initialize with empty study plan and selected courses
          updateStudyPlan(selectedSemester.shortName, []);
          updateUnifiedSelectedCourses(selectedSemester.shortName, []);
        }
      } catch (error) {
        console.error("❌ Error fetching study plan:", error);
        errorHandlingService.handleError(error);

        // Initialize with empty study plan and selected courses on error
        updateStudyPlan(selectedSemester.shortName, []);
        updateUnifiedSelectedCourses(selectedSemester.shortName, []);
      } finally {
        setIsStudyPlanLoading(false);
      }
    };

    // Only fetch if we have the required parameters
    if (authToken && selectedSemester?.id) {
      fetchStudyPlan();
    } else {
      setIsStudyPlanLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, selectedSemester?.id, selectedSemester?.shortName]);

  return {
    isStudyPlanLoading,
  };
};

export default useStudyPlanDataSimplified;
