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
import axiosClient from "./axiosClient";
import { useUnifiedCourseData } from "./useUnifiedCourseData";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

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
    useUnifiedCourseData();

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
        console.log(
          `🔄 [SIMPLIFIED] Fetching enrolled courses for semester: ${selectedSemester.shortName} (ID: ${selectedSemester.id})`
        );

        const response = await axiosClient.get(
          `https://integration.unisg.ch/EventApi/MyCourses/byTerm/${selectedSemester.id}`,
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
          `✅ [SIMPLIFIED] Successfully fetched ${response.data.length} enrolled courses`
        );
        console.log("🔍 [DEBUG] Enrolled courses structure:", response.data);

        // Log a sample course if available
        if (response.data.length > 0) {
          console.log("🔍 [DEBUG] Sample enrolled course:", response.data[0]);
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
