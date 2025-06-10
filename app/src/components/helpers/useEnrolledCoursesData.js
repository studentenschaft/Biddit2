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
import { useRecoilValue } from "recoil";
import axios from "axios";
import { enrolledCoursesState } from "../recoil/enrolledCoursesAtom";
import { useUpdateEnrolledCoursesAtom } from "./useUpdateEnrolledCourses";
import { useUnifiedCourseData } from "./useUnifiedCourseData";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

/**
 * Custom hook for managing enrolled courses data
 *
 * @param {Object} params - Hook parameters
 * @param {string} params.authToken - Authentication token
 * @param {Object} params.selectedSemesterState - Current selected semester state
 * @param {number} params.index - Semester index for legacy system
 * @returns {Object} Enrolled courses state and loading status
 */
export const useEnrolledCoursesData = ({
  authToken,
  selectedSemesterState,
  index,
}) => {
  // Recoil state and hooks
  const enrolledCourses = useRecoilValue(enrolledCoursesState);
  const updateEnrolledCourses = useUpdateEnrolledCoursesAtom();
  const { updateEnrolledCourses: updateUnifiedEnrolledCourses } =
    useUnifiedCourseData();

  // Local loading state
  const [isEnrolledCoursesLoading, setIsEnrolledCoursesLoading] =
    useState(true);

  // Fetch enrolled courses effect
  useEffect(() => {
    const fetchEnrolledCourses = async () => {
      // Check if we need to fetch enrolled courses
      if (
        index != null &&
        enrolledCourses &&
        (!enrolledCourses[index] || enrolledCourses[index].length === 0)
      ) {
        setIsEnrolledCoursesLoading(true);

        try {
          console.log(
            `🔄 Fetching enrolled courses for semester: ${selectedSemesterState.shortName}`
          );

          const response = await axios.get(
            `https://integration.unisg.ch/EventApi/MyCourses/byTerm/${selectedSemesterState.id}`,
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
            `✅ Successfully fetched ${response.data.length} enrolled courses`
          );

          // Update legacy enrolled courses state (by index)
          updateEnrolledCourses(response.data, index);

          // Update unified enrolled courses state (by semester short name)
          if (selectedSemesterState?.shortName) {
            updateUnifiedEnrolledCourses(
              selectedSemesterState.shortName,
              response.data
            );
          }
        } catch (error) {
          console.error("❌ Error fetching enrolled courses:", error);
          errorHandlingService.handleError(error);
        } finally {
          setIsEnrolledCoursesLoading(false);
        }
      } else {
        // Enrolled courses already exist, no need to fetch
        setIsEnrolledCoursesLoading(false);
      }
    };

    // Only fetch if we have the required parameters
    if (authToken && selectedSemesterState && index != null) {
      fetchEnrolledCourses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, selectedSemesterState, index]);

  return {
    isEnrolledCoursesLoading,
  };
};

export default useEnrolledCoursesData;
