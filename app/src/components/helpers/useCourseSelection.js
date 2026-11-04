// hooks/useCourseSelection.js
import { useCallback } from "react";
import { useInvalidateStudyPlan } from "../recoil/studyPlanLoadState";
import { saveCourse, deleteCourse } from "./api";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
import { normalizeSemesterName } from "./courseSelection";
import { useUnifiedCourseDataWriters } from "./useUnifiedCourseDataWriters";
import { trackWishlistChange } from "./analytics";
import { log } from "./log";
import { toEcts } from "../../domain/credits";

/**
 * Shared hook for adding or removing a course in local and backend states.
 * Handles bidirectional synchronization between EventListContainer and StudyOverview/Transcript.
 * UPDATED: Now works with unified course data system
 *
 * @param {Object} props - an object containing:
 *   selectedCourseIds: the array of currently selected course IDs (in local state)
 *   setSelectedCourseIds: the setter for selectedCourseIds (optional - can be null)
 *   selectedSemesterShortName: e.g. 'FS 23'
 *   authToken: the user authentication token
 */
export function useCourseSelection({
  selectedCourseIds,
  setSelectedCourseIds = null, // Now optional
  selectedSemesterShortName,
  authToken,
}) {
  // Unified course data hook for managing selected courses
  const { addSelectedCourse, removeSelectedCourse } = useUnifiedCourseDataWriters();
  // A failed write leaves the optimistic local state ahead of the server, so
  // the study plan is refetched to re-sync it.
  const invalidateStudyPlan = useInvalidateStudyPlan();

  /**
   * Adds or removes the course from local state and from the backend.
   * @param {Object} course - the course object with {id, shortName, classification, credits, ...}
   */
  const addOrRemoveCourse = useCallback(
    async (course) => {
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

      trackWishlistChange({
        action: isCourseSelected ? "remove" : "add",
        courseNumber,
        credits: toEcts(course.credits, 4),
        classification: course.classification,
        semester: normalizedCourseSemester,
      });

      try {
        // Use the course's actual semester for API calls - this is critical for Transcript
        // where courses from multiple semesters are displayed
        const studyPlanId = normalizedCourseSemester;

        log.debug('🔍 [useCourseSelection] API operation:', {
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
          const deleted = await deleteCourse(studyPlanId, courseNumber, authToken);
          if (!deleted) invalidateStudyPlan();
          log.debug(
            `✅ Course ${courseNumber} deleted from backend (studyPlan: ${studyPlanId})`
          );

          // Übergangslösung: To ensure old id-based courses get removed as well
          if (course.id && course.id !== courseNumber) {
            await deleteCourse(studyPlanId, course.id, authToken);
            log.debug(`Course ${course.id} deleted from backend (legacy)`);
          }

          // Also try deletion with course.courseId if different
          if (course.courseId && course.courseId !== courseNumber && course.courseId !== course.id) {
            await deleteCourse(studyPlanId, course.courseId, authToken);
            log.debug(`✅ Course ${course.courseId} deleted from backend (courseId)`);
          }
        } else {
          // Add course to unified state using the course's actual semester
          addSelectedCourse(normalizedCourseSemester, course);

          // Update legacy selectedCourseIds if setter is provided
          if (setSelectedCourseIds) {
            setSelectedCourseIds((prevIds) => [...prevIds, courseNumber]);
          }

          // Save to backend using the course's actual semester
          const saved = await saveCourse(studyPlanId, courseNumber, authToken);
          if (!saved) invalidateStudyPlan();
          log.debug(
            `Course ${courseNumber} saved to backend (studyPlan: ${studyPlanId})`
          );
        }
      } catch (error) {
        console.error("Error updating course:", error);
        errorHandlingService.handleError(error);
        invalidateStudyPlan();
      }
    },
    [
      authToken,
      selectedCourseIds,
      setSelectedCourseIds,
      selectedSemesterShortName,
      addSelectedCourse,
      removeSelectedCourse,
      invalidateStudyPlan,
    ]
  );

  return { addOrRemoveCourse };
}
