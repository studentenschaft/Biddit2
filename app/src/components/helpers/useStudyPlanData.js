/**
 * useStudyPlanData Hook
 *
 * Manages study plan fetching, initialization, and local state updates for EventListContainer.
 * This hook consolidates all study plan related operations that were previously scattered
 * throughout the main component.
 *
 * Responsibilities:
 * - Fetch study plans from API
 * - Initialize new semesters when no study plan exists
 * - Update local selected courses when study plan is found
 * - Manage both legacy (index-based) and unified (semester-based) course selections
 * - Handle study plan state in Recoil
 *
 * Flow:
 * 1. Fetch study plans when authToken and selectedSemester change
 * 2. Find matching study plan by semester ID or short name
 * 3. If found: update all related states (selectedCourseIds, local courses, unified courses)
 * 4. If not found: initialize new semester study plan in backend
 * 5. Update hasSetLocalSelectedCourses flag to prevent duplicate operations
 */

import { useState, useEffect } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import { selectedCourseIdsAtom } from "../recoil/selectedCourseIdsAtom";
import { currentStudyPlanIdState } from "../recoil/currentStudyPlanIdAtom";
import { studyPlanAtom } from "../recoil/studyPlanAtom";
import { localSelectedCoursesState } from "../recoil/localSelectedCoursesAtom";
import { localSelectedCoursesSemKeyState } from "../recoil/localSelectedCoursesSemKeyAtom";
import { allCourseInfoState } from "../recoil/allCourseInfosSelector";
import { getStudyPlan, initializeSemester } from "./api";
import { findStudyPlanBySemester } from "./courseSelection";
import { useCurrentSemester } from "./studyOverviewHelpers";
import { useUnifiedCourseData } from "./useUnifiedCourseData";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

/**
 * Custom hook for managing study plan data and related course selections
 *
 * @param {Object} params - Hook parameters
 * @param {string} params.authToken - Authentication token
 * @param {Object} params.selectedSemesterState - Current selected semester state
 * @param {number} params.index - Semester index for legacy system
 * @returns {Object} Study plan state and management functions
 */
export const useStudyPlanData = ({
  authToken,
  selectedSemesterState,
  index,
}) => {
  // Recoil state hooks
  const [, setSelectedCourseIds] = useRecoilState(selectedCourseIdsAtom);
  const [, setCurrentStudyPlanId] = useState(null);
  const [, setCurrentStudyPlanIdState] = useRecoilState(
    currentStudyPlanIdState
  );
  const [, setStudyPlan] = useRecoilState(studyPlanAtom);
  const [, setLocalSelectedCourses] = useRecoilState(localSelectedCoursesState);
  const [, setLocalSelectedCoursesSemKey] = useRecoilState(
    localSelectedCoursesSemKeyState
  );
  const allCourseInfo = useRecoilValue(allCourseInfoState);

  // Local state
  const [currentStudyPlan, setCurrentStudyPlan] = useState(null);
  const [hasSetLocalSelectedCourses, setHasSetLocalSelectedCourses] =
    useState(false);

  // Helpers
  const currentRealSemesterName = useCurrentSemester();
  const { updateSelectedCourses: updateUnifiedSelectedCourses } =
    useUnifiedCourseData();

  // Reset hasSetLocalSelectedCourses when semester changes
  useEffect(() => {
    setHasSetLocalSelectedCourses(false);
  }, [selectedSemesterState?.shortName]);

  // Main study plan fetching effect
  useEffect(() => {
    const fetchStudyPlanData = async () => {
      if (!authToken || !selectedSemesterState) {
        console.error("No auth token or selected semester");
        return;
      }

      try {
        setStudyPlan((prev) => ({ ...prev, isLoading: true }));
        const studyPlansData = await getStudyPlan(authToken);

        // Use helper to find matching plan
        const currentSemesterId = selectedSemesterState.cisId;
        const semesterName = selectedSemesterState.shortName;

        const foundStudyPlan = findStudyPlanBySemester(
          studyPlansData,
          currentSemesterId,
          semesterName,
          currentRealSemesterName
        );

        console.warn("studyPlan found:", foundStudyPlan);

        if (foundStudyPlan) {
          // Set global state first
          setSelectedCourseIds(foundStudyPlan.courses);
          setCurrentStudyPlanId(foundStudyPlan.id);
          setCurrentStudyPlanIdState(foundStudyPlan.id);
          setCurrentStudyPlan(foundStudyPlan);

          // Update local selected courses if we have course info for this semester
          if (allCourseInfo[index] && allCourseInfo[index].length > 0) {
            updateLocalSelectedCourses(
              foundStudyPlan,
              selectedSemesterState,
              index,
              allCourseInfo
            );
            setHasSetLocalSelectedCourses(true);
          }

          setStudyPlan({
            currentPlan: foundStudyPlan,
            allPlans: studyPlansData,
            isLoading: false,
            error: null,
          });
        } else {
          // Initialize new semester study plan
          console.warn("initializing new semester study plan:", semesterName);

          if (!semesterName) {
            console.error(
              "No semester name provided for initialization of new semester study plan"
            );
            return;
          }

          const newStudyPlan = await initializeSemester(
            semesterName,
            authToken
          );
          console.warn("new study plan:", newStudyPlan);

          // Re-fetch the study plan data to get the newly created plan
          fetchStudyPlanData();
        }
      } catch (error) {
        console.error("Error fetching study plan data:", error);
        setStudyPlan((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || "Failed to fetch study plan",
        }));
        errorHandlingService.handleError(error);
      }
    };

    fetchStudyPlanData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, selectedSemesterState]);

  // Effect to set up local selected courses once we have all course info and study plan
  useEffect(() => {
    if (
      allCourseInfo[index] &&
      allCourseInfo[index].length > 0 &&
      !hasSetLocalSelectedCourses &&
      currentStudyPlan &&
      index != null
    ) {
      updateLocalSelectedCourses(
        currentStudyPlan,
        selectedSemesterState,
        index,
        allCourseInfo
      );
      setHasSetLocalSelectedCourses(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentStudyPlan,
    index,
    selectedSemesterState?.shortName,
    hasSetLocalSelectedCourses,
    allCourseInfo,
  ]);

  /**
   * Updates local selected courses in both legacy and unified systems
   * @param {Object} studyPlan - Study plan containing course selections
   * @param {Object} selectedSemester - Selected semester state
   * @param {number} semesterIndex - Semester index for legacy system
   * @param {Object} courseInfo - All course information
   */
  const updateLocalSelectedCourses = (
    studyPlan,
    selectedSemester,
    semesterIndex,
    courseInfo
  ) => {
    const coursesToFind = courseInfo[semesterIndex] || [];

    // Update index-based atom (legacy system)
    setLocalSelectedCourses((prevCourses) => {
      const updatedCourses = { ...prevCourses };
      updatedCourses[semesterIndex] = studyPlan.courses
        .map((courseIdentifier) => {
          return coursesToFind.find(
            (course) =>
              course.courseNumber === courseIdentifier ||
              course.id === courseIdentifier
          );
        })
        .filter(Boolean);
      return updatedCourses;
    });

    // Update semester key-based atom (unified system)
    setLocalSelectedCoursesSemKey((prevCourses) => {
      const updatedCourses = { ...prevCourses };
      const semKey = selectedSemester.shortName;
      updatedCourses[semKey] = studyPlan.courses
        .map((courseIdentifier) => {
          const course = coursesToFind.find(
            (c) =>
              c.courseNumber === courseIdentifier || c.id === courseIdentifier
          );
          if (!course) return null;
          return {
            id: course.id,
            shortName: course.shortName,
            classification: course.classification,
            credits: course.credits,
            big_type: course.big_type,
            calendarEntry: course.calendarEntry || [],
            courseNumber: course.courseNumber,
          };
        })
        .filter(Boolean);
      return updatedCourses;
    });

    // Update unified selected courses
    const selectedCourses = studyPlan.courses
      .map((courseIdentifier) => {
        const course = coursesToFind.find(
          (c) =>
            c.courseNumber === courseIdentifier || c.id === courseIdentifier
        );
        return course || null;
      })
      .filter(Boolean);

    updateUnifiedSelectedCourses(selectedSemester.shortName, selectedCourses);
  };

  return {
    currentStudyPlan,
    hasSetLocalSelectedCourses,
    setHasSetLocalSelectedCourses,
  };
};

export default useStudyPlanData;
