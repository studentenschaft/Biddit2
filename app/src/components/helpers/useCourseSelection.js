// hooks/useCourseSelection.js
import { useRecoilState, useRecoilValue } from "recoil";
import { localSelectedCoursesState } from "../recoil/localSelectedCoursesAtom";
import { localSelectedCoursesSemKeyState } from "../recoil/localSelectedCoursesSemKeyAtom";
import { currentStudyPlanIdState } from "../recoil/currentStudyPlanIdAtom";
import { coursesWithTypesSelector } from "../recoil/coursesWithTypesSelector";
import { saveCourse, deleteCourse } from "./api";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
import { normalizeSemesterName } from "./courseSelection";

// Helper function to normalize credits from API format to display format
const normalizeCredits = (credits) => {
  if (!credits) return 4; // Default to 4 ECTS
  if (typeof credits === 'number' && credits > 99) {
    return credits / 100; // Convert 400 -> 4, 200 -> 2, etc.
  }
  return credits;
};

/**
 * Shared hook for adding or removing a course in local and backend states.
 * Handles bidirectional synchronization between EventListContainer and StudyOverview/Transcript.
 * 
 * @param {Object} props - an object containing:
 *   selectedCourseIds: the array of currently selected course IDs (in local state)
 *   setSelectedCourseIds: the setter for selectedCourseIds
 *   selectedSemesterShortName: e.g. 'FS 23'
 *   index: the integer index of the selected semester
 *   authToken: the user authentication token
 */
export function useCourseSelection({
  selectedCourseIds,
  setSelectedCourseIds,
  selectedSemesterShortName,
  index,
  authToken,
}) {
  // Recoil: local course selections
  const [, setLocalSelectedCourses] = useRecoilState(localSelectedCoursesState);
  // Recoil: local course selections keyed by semester shortName
  const [, setLocalSelectedCoursesSemKey] = useRecoilState(
    localSelectedCoursesSemKeyState
  );

  // Recoil: current study plan
  const currentStudyPlanId = useRecoilValue(currentStudyPlanIdState);
  // Recoil: classification to big_type map for categorizing
  const categoryTypeMap = useRecoilValue(coursesWithTypesSelector);

  /**
   * Adds or removes the course from local state and from the backend.
   * @param {Object} course - the course object with {id, shortName, classification, credits, ...}
   */
  async function addOrRemoveCourse(course) {
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
        selectedCourseIds.includes(course.courseNumber);

      if (isCourseSelected) {
        // Remove course locally and on the backend
        setSelectedCourseIds((prevIds) =>
          prevIds.filter((id) => id !== course.id && id !== course.courseNumber)
        );

        //new: courseNumber based
        await deleteCourse(currentStudyPlanId, course.courseNumber, authToken);
        console.log(`Course ${course.courseNumber} deleted from backend`);
        // Übergangslösung: To ensure old id-based courses get removed as well
        await deleteCourse(currentStudyPlanId, course.id, authToken);
        console.log(`Course ${course.id} deleted from backend`);
      } else {
        // Add course locally and on the backend
        setSelectedCourseIds((prevIds) => [...prevIds, course.courseNumber]);

        await saveCourse(currentStudyPlanId, course.courseNumber, authToken);
        console.log(`Course ${course.courseNumber} saved to backend`);
      }
    } catch (error) {
      console.error("Error updating course:", error);
      errorHandlingService.handleError(error);
    }
  }

  return { addOrRemoveCourse };
}
