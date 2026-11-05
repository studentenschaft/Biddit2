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
import { loadCatalogForTerm } from "./catalogLoader";
import { useUnifiedCourseDataWriters } from "./useUnifiedCourseDataWriters";
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
    useUnifiedCourseDataWriters();
  const [isCourseDataLoading, setIsCourseDataLoading] = useState(true);

  const { authToken, selectedSemester } = params || {};

  // Fetch course data effect
  useEffect(() => {
    // Without params there is nothing to fetch and no state to reset.
    if (!params) return;

    const fetchCourseData = async () => {
      // Only fetch if we have required data
      if (!selectedSemester?.cisId || !selectedSemester?.shortName) {
        setIsCourseDataLoading(false);
        return;
      }

      setIsCourseDataLoading(true);
      try {
        const result = await loadCatalogForTerm({
          term: selectedSemester,
          authToken,
        });
        if (result.source === "none") {
          errorHandlingService.handleError(result.error);
        } else {
          updateUnifiedAvailableCourses(
            selectedSemester.shortName,
            result.courses,
            {
              usingReferenceData: result.usingReferenceData,
              referenceSemester: result.referenceSemester,
            }
          );
        }
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
  }, [
    authToken,
    selectedSemester?.cisId,
    selectedSemester?.shortName,
    selectedSemester?.referenceCisId,
  ]);

  // Handle null parameters AFTER calling all hooks
  if (!params) return { isCourseDataLoading: false };

  return { isCourseDataLoading };
};

export default useCourseInfoData;
