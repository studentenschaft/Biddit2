/**
 * useCourseRatingsData Hook
 *
 * Manages fetching and updating course ratings data for EventListContainer.
 * This hook consolidates all course ratings related operations that were previously
 * part of the main component.
 *
 * Responsibilities:
 * - Fetch course ratings from the SHSG API (once per app session)
 * - Update both legacy and unified course ratings state
 * - Manage loading states for course ratings
 * - Handle API errors gracefully
 *
 * Flow:
 * 1. Check if course ratings already exist (global data)
 * 2. If not, fetch from SHSG API
 * 3. Update legacy course ratings state
 * 4. Update unified course ratings for all semesters (since ratings are global)
 * 5. Manage loading state throughout the process
 *
 * Note: Course ratings are global data that applies to all semesters,
 * so they are fetched once and shared across the application.
 */

import { useState, useEffect } from "react";
import { useRecoilState } from "recoil";
import axiosClient from "./axiosClient";
import { shsgCourseRatingsState } from "../recoil/shsgCourseRatingsAtom";
import { useUnifiedCourseData } from "./useUnifiedCourseData";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

/**
 * Custom hook for managing course ratings data
 *
 * @param {Object} params - Hook parameters
 * @param {string} params.authToken - Authentication token
 * @returns {Object} Course ratings state and loading status
 */
export const useCourseRatingsData = ({ authToken }) => {
  // Recoil state and hooks
  const [shsgCourseRatings, setShsgCourseRatings] = useRecoilState(
    shsgCourseRatingsState
  );
  const {
    updateCourseRatingsForAllSemesters:
      updateUnifiedCourseRatingsForAllSemesters,
  } = useUnifiedCourseData();

  // Local loading state
  const [isCourseRatingsLoading, setIsCourseRatingsLoading] = useState(true);

  // Fetch course ratings effect
  useEffect(() => {
    const fetchCourseRatings = async () => {
      // Check if we need to fetch course ratings (global data, fetch once)
      if (authToken && !shsgCourseRatings) {
        setIsCourseRatingsLoading(true);

        try {
          console.log("🔄 Fetching course ratings from SHSG API...");

          const response = await axiosClient({
            method: "get",
            maxBodyLength: Infinity,
            url: "https://api.shsg.ch/course-ratings",
            headers: {
              "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
              "X-RequestedLanguage": "DE",
              "API-Version": "1",
              Authorization: "Bearer " + authToken,
            },
          });

          console.log(
            `✅ Successfully fetched ${response.data.length} course ratings`
          );

          // Update legacy course ratings state
          setShsgCourseRatings(response.data);

          // Update unified course ratings for ALL semesters
          // Since ratings are global data that applies to all semesters
          updateUnifiedCourseRatingsForAllSemesters(response.data);
        } catch (error) {
          console.error("❌ Error fetching course ratings:", error);
          errorHandlingService.handleError(error);
        } finally {
          setIsCourseRatingsLoading(false);
        }
      } else {
        // Course ratings already exist or no auth token, no need to fetch
        setIsCourseRatingsLoading(false);
      }
    };

    fetchCourseRatings();
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  return {
    isCourseRatingsLoading,
    shsgCourseRatings,
  };
};

export default useCourseRatingsData;
