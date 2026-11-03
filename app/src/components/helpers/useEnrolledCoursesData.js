/**
 * useEnrolledCoursesData Hook
 *
 * Manages fetching and updating enrolled courses data for EventListContainer.
 * This hook consolidates all enrolled courses related operations that were previously
 * part of the main component.
 *
 * Responsibilities:
 * - Fetch enrolled courses from the UNISG EventApi
 * - Update both legacy (index-based) and unified (semester-based) enrolled courses state
 * - Manage loading states for enrolled courses
 * - Handle API errors gracefully
 *
 * Flow:
 * 1. Check if enrolled courses already exist for the semester
 * 2. If not, fetch from API using semester ID
 * 3. Update legacy enrolled courses state (by index)
 * 4. Update unified enrolled courses state (by semester short name)
 * 5. Manage loading state throughout the process
 */

import { useState, useEffect } from "react";
import { apiClient } from "./axiosClient";
import { myCoursesUrl } from "./apiEndpoints";
import { useUnifiedCourseDataWriters } from "./useUnifiedCourseDataWriters";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
import { log } from "./log";

/**
 * Custom hook for managing enrolled courses data
 *
 * @param {Object} params - Hook parameters
 * @param {string} params.authToken - Authentication token
 * @param {Object} params.selectedSemester - Current selected semester from termListObject
 *   Structure: {cisId, shortName, isCurrent, isProjected}
 * @returns {Object} Enrolled courses state and loading status
 */
export const useEnrolledCoursesData = ({ authToken, selectedSemester }) => {
  // Unified course data hook - no more legacy atoms
  const { updateEnrolledCourses: updateUnifiedEnrolledCourses } =
    useUnifiedCourseDataWriters();

  // Local loading state
  const [isEnrolledCoursesLoading, setIsEnrolledCoursesLoading] =
    useState(true);

  // Fetch enrolled courses effect
  useEffect(() => {
    const fetchEnrolledCourses = async () => {
      // Only fetch if we have required data
      if (!selectedSemester?.id || !selectedSemester?.shortName) {
        setIsEnrolledCoursesLoading(false);
        return;
      }

      setIsEnrolledCoursesLoading(true);

      try {
        log.debug(
          `🔄 [SIMPLIFIED] Fetching enrolled courses for semester: ${selectedSemester.shortName} (ID: ${selectedSemester.id})`
        );

        const response = await apiClient.get(
          myCoursesUrl(selectedSemester.id),
          authToken,
          { headers: { "X-RequestedLanguage": "EN" } }
        );

        log.debug(
          `✅ [SIMPLIFIED] Successfully fetched ${response.data.length} enrolled courses`
        );
        log.debug("🔍 [DEBUG] Enrolled courses structure:", response.data);

        // Log a sample course if available
        if (response.data.length > 0) {
          log.debug("🔍 [DEBUG] Sample enrolled course:", response.data[0]);
        }

        // Update ONLY unified enrolled courses state (no more legacy atoms)
        updateUnifiedEnrolledCourses(selectedSemester.shortName, response.data);
      } catch (error) {
        console.error("❌ Error fetching enrolled courses:", error);
        errorHandlingService.handleError(error);
      } finally {
        setIsEnrolledCoursesLoading(false);
      }
    };

    // Only fetch if we have the required parameters
    if (authToken && selectedSemester?.id) {
      fetchEnrolledCourses();
    } else {
      setIsEnrolledCoursesLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, selectedSemester?.id, selectedSemester?.shortName]);

  return {
    isEnrolledCoursesLoading,
  };
};

export default useEnrolledCoursesData;
