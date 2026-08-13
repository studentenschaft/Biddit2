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

// A term shows its previous-year same-season catalog as a preview until it has
// published at least this many courses (or if its own catalog errors). Counts
// parent courses as returned by the API (before exercise-group flattening).
export const REFERENCE_FALLBACK_MIN_COURSES = 10;

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

  const { authToken, selectedSemester } = params || {};

  // Fetch course data effect
  useEffect(() => {
    // Without params there is nothing to fetch and no state to reset.
    if (!params) return;

    const fetchTerm = (cisId) =>
      axios.get(
        `https://integration.unisg.ch/EventApi/CourseInformationSheets/myLatestPublishedPossiblebyTerm/${cisId}`,
        {
          headers: {
            "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
            "X-RequestedLanguage": "EN",
            "API-Version": "1",
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

    const fetchCourseData = async () => {
      // Only fetch if we have required data
      if (!selectedSemester?.cisId || !selectedSemester?.shortName) {
        setIsCourseDataLoading(false);
        return;
      }

      setIsCourseDataLoading(true);

      const hasReference =
        selectedSemester.referenceCisId &&
        selectedSemester.referenceCisId !== selectedSemester.cisId;

      // Load the same-season previous-year catalog as a preview. Returns true
      // when reference data was stored.
      const loadReference = async (reason) => {
        if (!hasReference) return false;
        try {
          const refResponse = await fetchTerm(selectedSemester.referenceCisId);
          console.log(
            `🔄 [${reason}] Previewing ${selectedSemester.shortName} with ${refResponse.data.length} courses from reference ${selectedSemester.referenceSemester}`
          );
          updateUnifiedAvailableCourses(
            selectedSemester.shortName,
            refResponse.data,
            {
              usingReferenceData: true,
              referenceSemester: selectedSemester.referenceSemester,
            }
          );
          return true;
        } catch (refError) {
          console.warn(
            `⚠️ Failed to fetch reference semester ${selectedSemester.referenceSemester} for ${selectedSemester.shortName}`,
            refError
          );
          return false;
        }
      };

      try {
        const response = await fetchTerm(selectedSemester.cisId);
        const count = response.data?.length || 0;
        console.log(
          `✅ Fetched ${count} course sheets for ${selectedSemester.shortName}`
        );

        // Until a term has a real, non-trivial catalog, show last year's
        // same-season courses as a preview instead of an empty/near-empty list.
        if (count < REFERENCE_FALLBACK_MIN_COURSES && (await loadReference("sparse"))) {
          return;
        }

        updateUnifiedAvailableCourses(
          selectedSemester.shortName,
          response.data || [],
          { usingReferenceData: false }
        );
      } catch (error) {
        // The term's own catalog errored (e.g. the EventApi 500s for a term).
        // Prefer a previous-year preview over surfacing a hard error.
        console.error("❌ Error fetching course data:", error);
        if (!(await loadReference("error"))) {
          errorHandlingService.handleError(error);
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
  if (!params) {
    return {
      isCourseDataLoading: false,
      courseData: [],
      hasData: false,
    };
  }

  return {
    isCourseDataLoading,
  };
};

export default useCourseInfoData;
