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
import { useRecoilState } from "recoil";
import { apiClient } from "./axiosClient";
import { studyPlanLoadState } from "../recoil/studyPlanLoadState";
import { useUnifiedCourseDataWriters } from "./useUnifiedCourseDataWriters";
import { useDegradedMode } from "../common/useDegradedMode";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
import { log } from "./log";

/**
 * Simplified hook for managing study plan data
 *
 * @param {Object} params - Hook parameters
 * @param {string} params.authToken - Authentication token
 * @param {Object} params.selectedSemester - Current selected semester from termListObject
 *   Structure: {cisId, id, shortName, isCurrent, isProjected}
 * @returns {Object} Study plan state and loading status
 */
export const useStudyPlanDataSimplified = (params = {}) => {
  const { authToken, selectedSemester } = params;
  // Unified course data hook - no more legacy atoms
  const {
    updateSelectedCourses: updateUnifiedSelectedCourses,
    updateStudyPlan,
  } = useUnifiedCourseDataWriters();
  const { isDegradedMode } = useDegradedMode();
  const [{ loaded, version }, setLoadState] =
    useRecoilState(studyPlanLoadState);
  const hasSemester = Boolean(selectedSemester?.id && selectedSemester?.shortName);

  // Local loading state
  const [isStudyPlanLoading, setIsStudyPlanLoading] = useState(true);

  // Fetch study plan effect. The response covers every semester, so switching
  // semesters does not refetch; only a session start or an invalidation does.
  useEffect(() => {
    let cancelled = false;

    const fetchStudyPlan = async () => {
      setIsStudyPlanLoading(true);

      try {
        log.debug(
          `🔄 [SIMPLIFIED] Fetching study plan for semester: ${selectedSemester.shortName} (ID: ${selectedSemester.id})`
        );

        const response = await apiClient.get(
          "https://api.shsg.ch/study-plans",
          authToken
        );

        if (cancelled) return;
        const studyPlansData = response.data;

        log.debug("🔍 [DEBUG] Study plans raw data:", studyPlansData);
        log.debug(
          `🔍 [DEBUG] Looking for semester: ${selectedSemester.shortName}`
        );

        // Helper function to check if semester name is valid (not UUID or placeholder)
        const isValidSemesterName = (semesterName) => {
          // Valid format: HS25, FS26, etc. (2-3 letters + 2 digits)
          const validPattern = /^[A-Z]{2,3}\d{2}$/;
          
          // Exclude UUIDs (contain hyphens) and placeholders (contain " - Placeholder")
          const isUUID = semesterName.includes('-') && semesterName.length > 10;
          const isPlaceholder = semesterName.includes(' - Placeholder');
          
          return validPattern.test(semesterName) && !isUUID && !isPlaceholder;
        };

        // FIXED: Process ALL semesters from API response, but only valid ones
        const allSemesters = Object.keys(studyPlansData);
        const validSemesters = allSemesters.filter(isValidSemesterName);
        const invalidSemesters = allSemesters.filter(name => !isValidSemesterName(name));
        
        log.debug("🔄 [FIXED] Processing study plan data:");
        log.debug(`  ✅ Valid semesters (${validSemesters.length}):`, validSemesters);
        log.debug(`  ⚠️ Skipping invalid/legacy semesters (${invalidSemesters.length}):`, invalidSemesters.slice(0, 3), invalidSemesters.length > 3 ? '...' : '');
        
        let totalCoursesProcessed = 0;
        
        // Helper function to check if course ID is valid (not UUID or undefined)
        const isValidCourseId = (courseId) => {
          if (!courseId || courseId === 'undefined' || courseId === 'null') return false;
          
          // Valid format: "7,015,1.00", "11,702,1.00", etc. (numbers with commas and periods)
          const validPattern = /^\d+,\d+,\d+\.\d+$/;
          
          // Exclude UUIDs (contain hyphens and are long)
          const isUUID = typeof courseId === 'string' && courseId.includes('-') && courseId.length > 20;
          
          return validPattern.test(courseId) && !isUUID;
        };

        // Process only valid semester data
        validSemesters.forEach(semesterName => {
          const coursesList = studyPlansData[semesterName];
          const allCourses = coursesList || [];
          
          // Filter to only valid course IDs
          const validCourses = allCourses.filter(isValidCourseId);
          const invalidCourses = allCourses.filter(courseId => !isValidCourseId(courseId));
          
          if (validCourses.length > 0) {
            log.debug(
              `✅ [FIXED] Processing ${validCourses.length} valid courses for semester ${semesterName}:`,
              validCourses.slice(0, 3) // Show first 3 courses
            );
            
            if (invalidCourses.length > 0) {
              log.debug(`  ⚠️ Skipping ${invalidCourses.length} invalid course IDs:`, invalidCourses.slice(0, 2), invalidCourses.length > 2 ? '...' : '');
            }

            // Update BOTH the study plan raw data AND the unified selected courses
            // Store raw study plan data for filtering logic (these are the string course numbers)
            updateStudyPlan(semesterName, validCourses);

            // Update unified selected courses - this will make them appear in StudyOverview
            updateUnifiedSelectedCourses(semesterName, validCourses);
            
            totalCoursesProcessed += validCourses.length;
          } else {
            log.debug(`⚠️ [FIXED] No valid courses found for semester ${semesterName} (had ${allCourses.length} invalid courses)`);
            // Initialize empty data for semesters with no valid courses
            updateStudyPlan(semesterName, []);
            updateUnifiedSelectedCourses(semesterName, []);
          }
        });
        
        setLoadState((prev) => ({ ...prev, loaded: true }));

        log.debug(`🎯 [FIXED] Completed processing ${totalCoursesProcessed} total valid courses across ${validSemesters.length} valid semesters (${allSemesters.length} total in API)`);
        
        // Also log what we processed for the currently selected semester specifically
        const currentSemesterCourses = studyPlansData[selectedSemester.shortName] || [];
        log.debug(
          `🔍 [DEBUG] Current semester ${selectedSemester.shortName} has ${currentSemesterCourses.length} courses`
        );
      } catch (error) {
        if (cancelled) return;
        // If the kill switch flipped ON between render (captured isDegradedMode)
        // and this request landing, the interceptor rejects with a
        // DegradedModeError here instead of short-circuiting before the call.
        // Bail out without touching study-plan/unified state - wiping it here
        // would erase a wishlist loaded before the incident and stamp
        // lastFetched fresh (touchLastFetched: true), suppressing the
        // automatic recovery refetch once degraded mode clears.
        if (error?.isDegradedModeError) {
          return;
        }

        console.error("❌ Error fetching study plan:", error);
        errorHandlingService.handleError(error);

        // Initialize with empty study plan and selected courses on error
        updateStudyPlan(selectedSemester.shortName, []);
        updateUnifiedSelectedCourses(selectedSemester.shortName, []);
      } finally {
        if (!cancelled) setIsStudyPlanLoading(false);
      }
    };

    // Degraded mode: SHSG API is disabled, so skip the fetch entirely and
    // leave study-plan/unified state untouched (do NOT call updateStudyPlan
    // or updateUnifiedSelectedCourses here - that would stamp the cache
    // "fresh" via touchLastFetched, blocking the recovery refetch below, and
    // could wipe a wishlist loaded before the incident). Just resolve
    // loading so the course list doesn't spin forever.
    if (isDegradedMode) {
      setIsStudyPlanLoading(false);
      return;
    }

    // Wait for a selected semester so the term list has initialized the
    // semesters before the study plan writes into them.
    if (authToken && hasSemester && !loaded) {
      fetchStudyPlan();
    } else {
      setIsStudyPlanLoading(false);
    }
    return () => {
      cancelled = true;
    };
    // selectedSemester is only read for the error fallback and logging.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, hasSemester, isDegradedMode, loaded, version]);

  return {
    isStudyPlanLoading,
  };
};

export default useStudyPlanDataSimplified;
