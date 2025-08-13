/**
 * useCourseInfoData Hook
 *
 * Manages fetching and updating course information data for EventListContainer.
 * This hook consolidates all course information related operations that were previously
 * part of the main component.
 *
 * Responsibilities:
 * - Fetch course information sheets from the UNISG EventApi
 * - Update both legacy (index-based) and unified (semester-based) course info state
 * - Manage loading states for course data
 * - Handle API errors gracefully
 *
 * Flow:
 * 1. Check if course info already exists for the semester
 * 2. If not, fetch from API using CIS ID
 * 3. Update legacy course info state (by index)
 * 4. Update unified available courses state (by semester short name)
 * 5. Manage loading state throughout the process
 */

import { useState, useEffect } from "react";
import axios from "axios";
import { useUnifiedCourseData } from "./useUnifiedCourseData";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

/**
 * Custom hook for managing course information data
 *
 * @param {Object} params - Hook parameters
 * @param {string} params.authToken - Authentication token
 * @param {Object} params.selectedSemester - Current selected semester from termListObject
 *   Structure: {cisId, shortName, isCurrent, isProjected}
 * @returns {Object} Course info state and loading status
 */
export const useCourseInfoData = (params) => {
  // ALWAYS call hooks first - never put hooks after conditional returns
  const { updateAvailableCourses: updateUnifiedAvailableCourses } =
    useUnifiedCourseData();
  const [isCourseDataLoading, setIsCourseDataLoading] = useState(true);

  // Handle null parameters AFTER calling all hooks
  if (!params) {
    return {
      isCourseDataLoading: false,
      courseData: [],
      hasData: false
    };
  }

  const { authToken, selectedSemester } = params || {};

  // Fetch course data effect
  useEffect(() => {
    const fetchCourseData = async () => {
      // Only fetch if we have required data
      if (!selectedSemester?.cisId || !selectedSemester?.shortName) {
        setIsCourseDataLoading(false);
        return;
      }

      setIsCourseDataLoading(true);

      try {
        console.log(
          `🔄 [SIMPLIFIED] Fetching course data for semester: ${selectedSemester.shortName}, CIS ID: ${selectedSemester.cisId}`
        );

        const response = await axios.get(
          `https://integration.unisg.ch/EventApi/CourseInformationSheets/myLatestPublishedPossiblebyTerm/${selectedSemester.cisId}`,
          {
            headers: {
              "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
              "X-RequestedLanguage": "EN",
              "API-Version": "1",
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        console.log(
          `✅ [SIMPLIFIED] Successfully fetched ${response.data.length} course information sheets for ${selectedSemester.shortName}`
        );

        // Debug: Log the response if we get 0 courses
        if (response.data.length === 0) {
          console.warn(
            `⚠️ [DEBUG] No courses returned for semester ${selectedSemester.shortName} (CIS ID: ${selectedSemester.cisId}). This might be normal for future semesters.`
          );
        }

        // Update ONLY unified available courses state (no more legacy atoms)
        updateUnifiedAvailableCourses(
          selectedSemester.shortName,
          response.data
        );
      } catch (error) {
        console.error("❌ Error fetching course data:", error);
        errorHandlingService.handleError(error);
      } finally {
        setIsCourseDataLoading(false);
      }
    };

    // Only fetch if we have the required parameters
    if (authToken && selectedSemester?.cisId) {
      fetchCourseData();
    } else {
      setIsCourseDataLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, selectedSemester?.cisId, selectedSemester?.shortName]);

  return {
    isCourseDataLoading,
  };
};

export default useCourseInfoData;
