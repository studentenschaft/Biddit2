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
import { useRecoilValue } from "recoil";
import axios from "axios";
import { courseInfoState } from "../recoil/courseInfoAtom";
import { useUpdateCourseInfoAtom } from "./useUpdateCourseInfo";
import { useUnifiedCourseData } from "./useUnifiedCourseData";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

/**
 * Custom hook for managing course information data
 *
 * @param {Object} params - Hook parameters
 * @param {string} params.authToken - Authentication token
 * @param {string} params.cisId - Course Information System ID for the semester
 * @param {number} params.index - Semester index for legacy system
 * @param {Object} params.selectedSemesterState - Current selected semester state
 * @returns {Object} Course info state and loading status
 */
export const useCourseInfoData = ({
  authToken,
  cisId,
  index,
  selectedSemesterState,
}) => {
  // Recoil state and hooks
  const courseInfos = useRecoilValue(courseInfoState);
  const updateCourseInfo = useUpdateCourseInfoAtom();
  const { updateAvailableCourses: updateUnifiedAvailableCourses } =
    useUnifiedCourseData();

  // Local loading state
  const [isCourseDataLoading, setIsCourseDataLoading] = useState(true);

  // Fetch course data effect
  useEffect(() => {
    const fetchCourseData = async () => {
      // Check if we need to fetch course data
      if (
        index != null &&
        (!courseInfos[index] || courseInfos[index].length === 0)
      ) {
        setIsCourseDataLoading(true);

        try {
          console.log(
            `🔄 Fetching course data for semester: ${selectedSemesterState?.shortName}, CIS ID: ${cisId}`
          );

          const response = await axios.get(
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

          console.log(
            `✅ Successfully fetched ${response.data.length} course information sheets`
          );

          // Update legacy course info state (by index)
          updateCourseInfo(response.data, index);

          // Update unified available courses state (by semester short name)
          if (selectedSemesterState?.shortName) {
            updateUnifiedAvailableCourses(
              selectedSemesterState.shortName,
              response.data
            );
          }
        } catch (error) {
          console.error("❌ Error fetching course data:", error);
          errorHandlingService.handleError(error);
        } finally {
          setIsCourseDataLoading(false);
        }
      } else {
        // Course data already exists, no need to fetch
        setIsCourseDataLoading(false);
      }
    };

    // Only fetch if we have the required parameters
    if (authToken && cisId && index != null) {
      fetchCourseData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, cisId, index]);

  return {
    isCourseDataLoading,
  };
};

export default useCourseInfoData;
