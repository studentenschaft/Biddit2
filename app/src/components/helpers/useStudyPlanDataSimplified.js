/**
 * useStudyPlanDataSimplified Hook - SIMPLIFIED VERSION
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
import { useSetRecoilState } from "recoil";
import axios from "axios";
import { useUnifiedCourseData } from "./useUnifiedCourseData";
import { selectedCourseIdsAtom } from "../recoil/selectedCourseIdsAtom";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

/**
 * Find study plan by semester ID
 * @param {Array} studyPlansArray - Array of study plans
 * @param {string} semesterId - Semester ID to search for
 * @returns {Object|null} - Found study plan or null
 */
const findStudyPlanBySemesterId = (studyPlansArray, semesterId) => {
  if (!studyPlansArray || !semesterId) return null;

  for (const studyPlan of studyPlansArray) {
    if (studyPlan.id === semesterId) {
      return studyPlan;
    }
  }
  return null;
};

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
  const { updateSelectedCourses: updateUnifiedSelectedCourses } =
    useUnifiedCourseData();

  // Set selected course IDs for the EventListContainer to use
  const setSelectedCourseIds = useSetRecoilState(selectedCourseIdsAtom);

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

        // Convert the object into an array of study plan objects
        const studyPlansArray = Object.keys(studyPlansData).map((key) => ({
          id: key,
          courses: studyPlansData[key],
        }));

        console.log(
          `✅ [SIMPLIFIED] Successfully fetched ${studyPlansArray.length} study plans`
        );
        console.log("🔍 [DEBUG] Study plans array:", studyPlansArray);

        // Find study plan for current semester
        const currentStudyPlan = findStudyPlanBySemesterId(
          studyPlansArray,
          selectedSemester.id
        );

        console.log("🔍 [DEBUG] Current study plan:", currentStudyPlan);

        if (currentStudyPlan && currentStudyPlan.courses) {
          console.log(
            `✅ [SIMPLIFIED] Found study plan for ${selectedSemester.shortName} with ${currentStudyPlan.courses.length} selected courses`
          );
          console.log(
            "🔍 [DEBUG] Study plan courses structure:",
            currentStudyPlan.courses
          );

          // Try different ways to extract course numbers
          let extractedCourseNumbers = [];

          // Method 1: Direct courseNumber property
          const method1 = currentStudyPlan.courses
            .map((course) => course.courseNumber)
            .filter(Boolean);
          console.log("🔍 [DEBUG] Method 1 - Direct courseNumber:", method1);

          // Method 2: Nested courses.courseNumber
          const method2 = currentStudyPlan.courses
            .map((course) => course.courses?.courseNumber)
            .filter(Boolean);
          console.log("🔍 [DEBUG] Method 2 - courses.courseNumber:", method2);

          // Method 3: Nested courses array with courseNumber
          const method3 = currentStudyPlan.courses
            .flatMap((course) => course.courses || [])
            .map((nestedCourse) => nestedCourse.courseNumber)
            .filter(Boolean);
          console.log(
            "🔍 [DEBUG] Method 3 - Flattened courses.courseNumber:",
            method3
          );

          // Method 4: Just use the course objects as they are
          console.log(
            "🔍 [DEBUG] Method 4 - Raw course objects:",
            currentStudyPlan.courses
          );

          // Use the method that gives us results
          if (method1.length > 0) {
            extractedCourseNumbers = method1;
            console.log("✅ [DEBUG] Using Method 1:", extractedCourseNumbers);
          } else if (method2.length > 0) {
            extractedCourseNumbers = method2;
            console.log("✅ [DEBUG] Using Method 2:", extractedCourseNumbers);
          } else if (method3.length > 0) {
            extractedCourseNumbers = method3;
            console.log("✅ [DEBUG] Using Method 3:", extractedCourseNumbers);
          } else {
            // Fallback: use the raw courses array and let the unified data handler figure it out
            extractedCourseNumbers = currentStudyPlan.courses;
            console.log(
              "✅ [DEBUG] Using Method 4 (raw objects):",
              extractedCourseNumbers
            );
          }

          // Update ONLY unified selected courses (no more legacy atoms)
          updateUnifiedSelectedCourses(
            selectedSemester.shortName,
            extractedCourseNumbers
          );

          // Also update the selectedCourseIds atom for EventListContainer UI
          console.log(
            "🔍 [DEBUG] Updating selectedCourseIds atom with:",
            extractedCourseNumbers
          );
          setSelectedCourseIds(extractedCourseNumbers);
        } else {
          console.log(
            `⚠️ [SIMPLIFIED] No study plan found for semester ${selectedSemester.shortName} (ID: ${selectedSemester.id})`
          );

          // Initialize with empty selected courses
          updateUnifiedSelectedCourses(selectedSemester.shortName, []);
        }
      } catch (error) {
        console.error("❌ Error fetching study plan:", error);
        errorHandlingService.handleError(error);

        // Initialize with empty selected courses on error
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
