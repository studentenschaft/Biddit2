// hooks/useCourseSelection.js
import { useRecoilState, useRecoilValue } from "recoil";
import { localSelectedCoursesState } from "../recoil/localSelectedCoursesAtom";
import { localSelectedCoursesSemKeyState } from "../recoil/localSelectedCoursesSemKeyAtom";
import { coursesWithTypesSelector } from "../recoil/coursesWithTypesSelector";
import { saveCourse, deleteCourse } from "./api";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
import { normalizeSemesterName } from "./courseSelection";
import { useUnifiedCourseData } from "./useUnifiedCourseData";
import { showServerOverloadNotification } from "../common/ServerOverloadNotification";

// Helper function to normalize credits from API format to display format
const normalizeCredits = (credits) => {
  if (credits === null || credits === undefined) return 4; // Default to 4 ECTS only for null/undefined
  if (typeof credits === "number" && credits > 99) {
    return credits / 100; // Convert 400 -> 4, 200 -> 2, etc.
  }
  return credits; // Return 0 for exercise groups, other values as-is
};

/**
 * Shared hook for adding or removing a course in local and backend states.
 * Handles bidirectional synchronization between EventListContainer and StudyOverview/Transcript.
 * UPDATED: Now works with unified course data system
 *
 * @param {Object} props - an object containing:
 *   selectedCourseIds: the array of currently selected course IDs (in local state)
 *   setSelectedCourseIds: the setter for selectedCourseIds (optional - can be null)
 *   selectedSemesterShortName: e.g. 'FS 23'
 *   index: the integer index of the selected semester (optional)
 *   authToken: the user authentication token
 */
export function useCourseSelection({
  selectedCourseIds,
  setSelectedCourseIds = null, // Now optional
  selectedSemesterShortName,
  index,
  authToken,
}) {
  // Unified course data hook for managing selected courses
  const { addSelectedCourse, removeSelectedCourse } = useUnifiedCourseData();

  // Recoil: local course selections
  const [, setLocalSelectedCourses] = useRecoilState(localSelectedCoursesState);
  // Recoil: local course selections keyed by semester shortName
  const [, setLocalSelectedCoursesSemKey] = useRecoilState(
    localSelectedCoursesSemKeyState
  );

  // Recoil: classification to big_type map for categorizing
  const categoryTypeMap = useRecoilValue(coursesWithTypesSelector);

  /**
   * Adds or removes the course from local state and from the backend.
   * @param {Object} course - the course object with {id, shortName, classification, credits, ...}
   */
  async function addOrRemoveCourse(course) {
    // SERVER OVERLOAD: Temporarily disable course saving to study plans
    showServerOverloadNotification();
    return;
    
    if (!authToken) {
      console.error("No auth token available");
      return;
    }

    // Update local selected courses (indexed by semester index)
    setLocalSelectedCourses((prevCourses) => {
      if (typeof prevCourses === "object" && prevCourses !== null) {
        const updatedCourses = { ...prevCourses };
        const courseIndex = updatedCourses[index]?.findIndex(
          (c) => c.id === course.id
        );

        if (courseIndex > -1) {
          // Remove course if it already exists
          updatedCourses[index] = [
            ...updatedCourses[index].slice(0, courseIndex),
            ...updatedCourses[index].slice(courseIndex + 1),
          ];
        } else {
          // Add course if it doesn't exist
          updatedCourses[index] = [...(updatedCourses[index] || []), course];
        }

        return updatedCourses;
      } else {
        console.error("prevCourses is not an object:", prevCourses);
        return { [index]: [course] };
      }
    });

    // Update local selected courses (indexed by shortName)
    setLocalSelectedCoursesSemKey((prevCourses) => {
      // Add debug logging to see what's happening
      const normalizedSemesterKey = normalizeSemesterName(
        selectedSemesterShortName
      );

      if (typeof prevCourses === "object" && prevCourses !== null) {
        const updatedCourses = { ...prevCourses };
        // Use the normalized semester key instead of the raw one
        const semKey = normalizedSemesterKey;
        // Create minimal course object with normalized credits
        const minimalCourse = {
          id: course.id,
          shortName: course.shortName,
          classification: course.classification,
          credits: normalizeCredits(course.credits), // Convert API format (400) to display format (4)
          big_type: categoryTypeMap[course.classification] || "",
          calendarEntry: course.calendarEntry || [],
          courseNumber: course.courseNumber || course.coursesNumber || "",
        };

        const courseIndex = updatedCourses[semKey]?.findIndex(
          (c) => c.id === minimalCourse.id
        );

        if (courseIndex > -1) {
          updatedCourses[semKey] = [
            ...updatedCourses[semKey].slice(0, courseIndex),
            ...updatedCourses[semKey].slice(courseIndex + 1),
          ];
        } else {
          updatedCourses[semKey] = [
            ...(updatedCourses[semKey] || []),
            minimalCourse,
          ];
        }

        return updatedCourses;
      }

      // Create new entry if prevCourses is not an object
      return {
        [normalizedSemesterKey]: [
          {
            id: course.id,
            shortName: course.shortName,
            classification: course.classification,
            credits: normalizeCredits(course.credits),
            big_type: categoryTypeMap[course.classification] || "",
            calendarEntry: course.calendarEntry || [],
            courseNumber: course.courseNumber || course.coursesNumber || "", // Fix to use either courseNumber or coursesNumber
          },
        ],
      };
    });

    try {
      const isCourseSelected =
        selectedCourseIds.includes(course.id) ||
        selectedCourseIds.includes(course.courseNumber) ||
        selectedCourseIds.includes(course.courses?.[0]?.courseNumber);

      // Extract the correct course number for API calls
      const courseNumber =
        course.courses?.[0]?.courseNumber || course.courseNumber || course.id;
      // Use selectedSemesterShortName as studyPlanId
      const studyPlanId = selectedSemesterShortName;

      if (isCourseSelected) {
        // Remove course from unified state and backend
        removeSelectedCourse(selectedSemesterShortName, courseNumber);

        // Update legacy selectedCourseIds if setter is provided
        if (setSelectedCourseIds) {
          setSelectedCourseIds((prevIds) =>
            prevIds.filter((id) => id !== course.id && id !== courseNumber)
          );
        }

        // Delete from backend using correct parameters
        await deleteCourse(studyPlanId, courseNumber, authToken);
        console.log(
          `Course ${courseNumber} deleted from backend (studyPlan: ${studyPlanId})`
        );

        // Übergangslösung: To ensure old id-based courses get removed as well
        if (course.id && course.id !== courseNumber) {
          await deleteCourse(studyPlanId, course.id, authToken);
          console.log(`Course ${course.id} deleted from backend (legacy)`);
        }
      } else {
        // Add course to unified state and backend
        addSelectedCourse(selectedSemesterShortName, course);

        // Update legacy selectedCourseIds if setter is provided
        if (setSelectedCourseIds) {
          setSelectedCourseIds((prevIds) => [...prevIds, courseNumber]);
        }

        // Save to backend using correct parameters
        await saveCourse(studyPlanId, courseNumber, authToken);
        console.log(
          `Course ${courseNumber} saved to backend (studyPlan: ${studyPlanId})`
        );
      }
    } catch (error) {
      console.error("Error updating course:", error);
      errorHandlingService.handleError(error);
    }
  }

  return { addOrRemoveCourse };
}
