import { useRecoilState, useRecoilValue } from "recoil";
import { courseInfoState } from "../recoil/courseInfoAtom";
import { enrolledCoursesState } from "../recoil/enrolledCoursesAtom";
import { localSelectedCoursesState } from "../recoil/localSelectedCoursesAtom";
import { localSelectedCoursesSemKeyState } from "../recoil/localSelectedCoursesSemKeyAtom";
import { shsgCourseRatingsState } from "../recoil/shsgCourseRatingsAtom";
import { cisIdListSelector } from "../recoil/cisIdListSelector";
import { useUnifiedCourseData } from "./useUnifiedCourseData";

/**
 * Migration utility to help transition from old state management to unified system
 * This hook can be used temporarily during the migration period
 */
export function useMigrationHelper() {
  const courseInfo = useRecoilValue(courseInfoState);
  const enrolledCourses = useRecoilValue(enrolledCoursesState);
  const localSelectedCourses = useRecoilValue(localSelectedCoursesState);
  const localSelectedCoursesSemKey = useRecoilValue(
    localSelectedCoursesSemKeyState
  );
  const shsgCourseRatings = useRecoilValue(shsgCourseRatingsState);
  const cisIdList = useRecoilValue(cisIdListSelector);
  const {
    updateEnrolledCoursesForSemester,
    updateAvailableCoursesForSemester,
    updateSelectedCoursesForSemester,
    updateCourseRatingsForSemester,
    initializeSemesterData,
  } = useUnifiedCourseData();

  /**
   * Migrate data from old atoms to unified system
   */
  const migrateToUnifiedSystem = async () => {
    try {
      console.log("Starting migration to unified course data system...");

      // Create semester shortName mapping from cisIdList
      const semesterMapping = {};
      cisIdList.forEach((item, index) => {
        if (item.shortName) {
          semesterMapping[index + 1] = item.shortName;
        }
      });

      // Migrate courseInfo and enrolledCourses (numeric keys -> semester shortNames)
      Object.keys(courseInfo).forEach((numericKey) => {
        const semesterShortName = semesterMapping[numericKey];
        if (!semesterShortName) return;

        // Initialize semester
        initializeSemester(semesterShortName);

        // Migrate available courses
        const availableCourses = courseInfo[numericKey] || [];
        updateAvailableCourses(semesterShortName, availableCourses);

        // Migrate enrolled courses
        const enrolled = enrolledCourses[numericKey] || [];
        updateEnrolledCourses(semesterShortName, enrolled);

        // Migrate local selected courses (numeric key based)
        const localSelected = localSelectedCourses[numericKey] || [];
        if (localSelected.length > 0) {
          updateSelectedCourses(semesterShortName, localSelected);
        }
      });

      // Migrate semester-keyed selected courses (these are already in the right format)
      Object.keys(localSelectedCoursesSemKey).forEach((semesterShortName) => {
        const selectedCourses =
          localSelectedCoursesSemKey[semesterShortName] || [];
        if (selectedCourses.length > 0) {
          initializeSemester(semesterShortName);
          updateSelectedCourses(semesterShortName, selectedCourses);
        }
      });

      // Migrate course ratings
      if (shsgCourseRatings && Array.isArray(shsgCourseRatings)) {
        // Group ratings by semester if possible, otherwise apply to all semesters
        const ratingsMap = {};
        shsgCourseRatings.forEach((rating) => {
          if (rating._id && rating.avgRating) {
            ratingsMap[rating._id] = rating.avgRating;
          }
        });

        // Apply ratings to all initialized semesters
        Object.keys(semesterMapping).forEach((numericKey) => {
          const semesterShortName = semesterMapping[numericKey];
          if (semesterShortName) {
            updateCourseRatings(semesterShortName, ratingsMap);
          }
        });
      }

      console.log("Migration completed successfully!");
      return true;
    } catch (error) {
      console.error("Migration failed:", error);
      return false;
    }
  };

  /**
   * Generate a summary of what data would be migrated
   */
  const getMigrationSummary = () => {
    const summary = {
      courseInfoSemesters: Object.keys(courseInfo).length,
      enrolledCoursesSemesters: Object.keys(enrolledCourses).length,
      localSelectedSemesters: Object.keys(localSelectedCourses).length,
      semesterKeySelectedSemesters: Object.keys(localSelectedCoursesSemKey)
        .length,
      totalRatings: Array.isArray(shsgCourseRatings)
        ? shsgCourseRatings.length
        : 0,
      availableSemesterMappings: cisIdList.length,
    };

    return summary;
  };

  return {
    migrateToUnifiedSystem,
    getMigrationSummary,
  };
}
