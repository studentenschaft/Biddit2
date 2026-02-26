// hooks/useCourseSelection.js
import { useRecoilState, useRecoilValue } from "recoil";
import { localSelectedCoursesState } from "../recoil/localSelectedCoursesAtom";
import { localSelectedCoursesSemKeyState } from "../recoil/localSelectedCoursesSemKeyAtom";
import { coursesWithTypesSelector } from "../recoil/coursesWithTypesSelector";
import { saveCourse, deleteCourse } from "./api";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
import { normalizeSemesterName } from "./courseSelection";
import { useUnifiedCourseData } from "./useUnifiedCourseData";

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
    if (!authToken) {
      console.error("No auth token available");
      return;
    }

    // Extract the course's actual semester - critical for Transcript tab where courses
    // from multiple semesters are displayed but selectedSemesterShortName is the UI's current selection
    const courseSemester = course.semester || course.originalCourse?.semester || selectedSemesterShortName;
    const normalizedCourseSemester = normalizeSemesterName(courseSemester);

    // ── Single authoritative decision: add or remove? ─────────────────────
    // Computed ONCE and used consistently for ALL state atoms to prevent
    // flip-flop bugs when atoms get out of sync.
    const isCourseSelected =
      selectedCourseIds.includes(course.id) ||
      selectedCourseIds.includes(course.courseNumber) ||
      selectedCourseIds.includes(course.courseId) ||
      selectedCourseIds.includes(course.courses?.[0]?.courseNumber);

    const courseNumber =
      course.courses?.[0]?.courseNumber || course.courseNumber || course.courseId || course.id;

    const minimalCourse = {
      id: course.id,
      shortName: course.shortName,
      classification: course.classification,
      credits: normalizeCredits(course.credits),
      big_type: categoryTypeMap[course.classification] || "",
      calendarEntry: course.calendarEntry || [],
      courseNumber: course.courseNumber || course.coursesNumber || "",
    };

    // Update local selected courses (indexed by semester index)
    setLocalSelectedCourses((prevCourses) => {
      if (typeof prevCourses === "object" && prevCourses !== null) {
        const updatedCourses = { ...prevCourses };

        if (isCourseSelected) {
          // Remove course
          const courseIndex = updatedCourses[index]?.findIndex(
            (c) => c.id === course.id
          );
          if (courseIndex > -1) {
            updatedCourses[index] = [
              ...updatedCourses[index].slice(0, courseIndex),
              ...updatedCourses[index].slice(courseIndex + 1),
            ];
          }
        } else {
          // Add course
          updatedCourses[index] = [...(updatedCourses[index] || []), course];
        }

        return updatedCourses;
      } else {
        console.error("prevCourses is not an object:", prevCourses);
        return isCourseSelected ? {} : { [index]: [course] };
      }
    });

    // Update local selected courses (indexed by shortName)
    // Use the course's actual semester for accurate state updates
    setLocalSelectedCoursesSemKey((prevCourses) => {
      const semKey = normalizedCourseSemester;

      if (typeof prevCourses === "object" && prevCourses !== null) {
        const updatedCourses = { ...prevCourses };

        if (isCourseSelected) {
          // Remove course
          const courseIndex = updatedCourses[semKey]?.findIndex(
            (c) => c.id === minimalCourse.id
          );
          if (courseIndex > -1) {
            updatedCourses[semKey] = [
              ...updatedCourses[semKey].slice(0, courseIndex),
              ...updatedCourses[semKey].slice(courseIndex + 1),
            ];
          }
        } else {
          // Add course
          updatedCourses[semKey] = [
            ...(updatedCourses[semKey] || []),
            minimalCourse,
          ];
        }

        return updatedCourses;
      }

      // Create new entry if prevCourses is not an object
      return isCourseSelected ? {} : { [semKey]: [minimalCourse] };
    });

    try {

      // Use the course's actual semester for API calls - this is critical for Transcript
      // where courses from multiple semesters are displayed
      const studyPlanId = normalizedCourseSemester;

      console.log('🔍 [useCourseSelection] API operation:', {
        isCourseSelected,
        courseNumber,
        studyPlanId,
        originalSelectedSemester: selectedSemesterShortName,
        courseSemester: normalizedCourseSemester
      });

      if (isCourseSelected) {
        // Remove course from unified state using the course's actual semester
        removeSelectedCourse(normalizedCourseSemester, courseNumber);

        // Update legacy selectedCourseIds if setter is provided
        if (setSelectedCourseIds) {
          setSelectedCourseIds((prevIds) =>
            prevIds.filter((id) => id !== course.id && id !== courseNumber && id !== course.courseId)
          );
        }

        // Delete from backend using the course's actual semester
        await deleteCourse(studyPlanId, courseNumber, authToken);
        console.log(
          `✅ Course ${courseNumber} deleted from backend (studyPlan: ${studyPlanId})`
        );

        // Übergangslösung: To ensure old id-based courses get removed as well
        if (course.id && course.id !== courseNumber) {
          await deleteCourse(studyPlanId, course.id, authToken);
          console.log(`Course ${course.id} deleted from backend (legacy)`);
        }

        // Also try deletion with course.courseId if different
        if (course.courseId && course.courseId !== courseNumber && course.courseId !== course.id) {
          await deleteCourse(studyPlanId, course.courseId, authToken);
          console.log(`✅ Course ${course.courseId} deleted from backend (courseId)`);
        }
      } else {
        // Add course to unified state using the course's actual semester
        addSelectedCourse(normalizedCourseSemester, course);

        // Update legacy selectedCourseIds if setter is provided
        if (setSelectedCourseIds) {
          setSelectedCourseIds((prevIds) => [...prevIds, courseNumber]);
        }

        // Save to backend using the course's actual semester
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
