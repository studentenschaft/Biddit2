import { useRecoilValue } from "recoil";
import { courseInfoState } from "../recoil/courseInfoAtom";
import { enrolledCoursesState } from "../recoil/enrolledCoursesAtom";
import { localSelectedCoursesState } from "../recoil/localSelectedCoursesAtom";
import { localSelectedCoursesSemKeyState } from "../recoil/localSelectedCoursesSemKeyAtom";
import { shsgCourseRatingsState } from "../recoil/shsgCourseRatingsAtom";
import { cisIdListSelector } from "../recoil/cisIdListSelector";
import { useUnifiedCourseData } from "./useUnifiedCourseData";

/**
 * Migration manager to transition from old state management to unified system
 * This provides utilities to migrate data and coordinate the transition
 */
export function useMigrationManager() {
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

      console.log("Semester mapping:", semesterMapping);

      // Migrate courseInfo and enrolledCourses (numeric keys -> semester shortNames)
      Object.keys(courseInfo).forEach((numericKey) => {
        const semesterShortName = semesterMapping[numericKey];
        if (!semesterShortName) {
          console.warn(
            `No semester mapping found for numeric key: ${numericKey}`
          );
          return;
        }

        // Initialize semester
        initializeSemesterData(semesterShortName);

        // Migrate available courses
        const availableCourses = courseInfo[numericKey] || [];
        if (availableCourses.length > 0) {
          console.log(
            `Migrating ${availableCourses.length} available courses for ${semesterShortName}`
          );
          updateAvailableCoursesForSemester(
            semesterShortName,
            availableCourses
          );
        }

        // Migrate enrolled courses
        const enrolled = enrolledCourses[numericKey] || [];
        if (enrolled.length > 0) {
          console.log(
            `Migrating ${enrolled.length} enrolled courses for ${semesterShortName}`
          );
          updateEnrolledCoursesForSemester(semesterShortName, enrolled);
        }

        // Migrate local selected courses (numeric index based)
        const localSelected = localSelectedCourses[numericKey] || [];
        if (localSelected.length > 0) {
          console.log(
            `Migrating ${localSelected.length} selected courses for ${semesterShortName}`
          );
          updateSelectedCoursesForSemester(semesterShortName, localSelected);
        }
      });

      // Migrate localSelectedCoursesSemKey (already semester-based)
      Object.keys(localSelectedCoursesSemKey).forEach((semesterShortName) => {
        const selectedCourses =
          localSelectedCoursesSemKey[semesterShortName] || [];
        if (selectedCourses.length > 0) {
          console.log(
            `Migrating ${selectedCourses.length} semester-keyed selected courses for ${semesterShortName}`
          );
          initializeSemesterData(semesterShortName);
          updateSelectedCoursesForSemester(semesterShortName, selectedCourses);
        }
      });

      // Migrate course ratings
      if (shsgCourseRatings) {
        console.log("Migrating course ratings to all semesters");
        // Process ratings into a map format
        let ratingsMap = {};
        if (Array.isArray(shsgCourseRatings)) {
          shsgCourseRatings.forEach((rating) => {
            if (rating._id && rating.avgRating) {
              ratingsMap[rating._id] = rating.avgRating;
            }
          });
        } else if (typeof shsgCourseRatings === "object") {
          ratingsMap = shsgCourseRatings;
        }

        // Apply ratings to all semesters
        Object.values(semesterMapping).forEach((semesterShortName) => {
          if (semesterShortName && Object.keys(ratingsMap).length > 0) {
            updateCourseRatingsForSemester(semesterShortName, ratingsMap);
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
    const semesterMapping = {};
    cisIdList.forEach((item, index) => {
      if (item.shortName) {
        semesterMapping[index + 1] = item.shortName;
      }
    });

    const summary = {
      courseInfoSemesters: Object.keys(courseInfo).filter(
        (key) => semesterMapping[key]
      ).length,
      enrolledCoursesSemesters: Object.keys(enrolledCourses).filter(
        (key) => semesterMapping[key]
      ).length,
      localSelectedSemesters: Object.keys(localSelectedCourses).filter(
        (key) => semesterMapping[key]
      ).length,
      semesterKeySelectedSemesters: Object.keys(localSelectedCoursesSemKey)
        .length,
      totalRatings: Array.isArray(shsgCourseRatings)
        ? shsgCourseRatings.length
        : typeof shsgCourseRatings === "object" && shsgCourseRatings !== null
        ? Object.keys(shsgCourseRatings).length
        : 0,
      availableSemesterMappings: Object.keys(semesterMapping).length,
      semesterMapping,
    };

    // Add detailed course counts
    summary.detailedCounts = {};
    Object.keys(courseInfo).forEach((numericKey) => {
      const semesterShortName = semesterMapping[numericKey];
      if (semesterShortName) {
        summary.detailedCounts[semesterShortName] = {
          available: (courseInfo[numericKey] || []).length,
          enrolled: (enrolledCourses[numericKey] || []).length,
          localSelected: (localSelectedCourses[numericKey] || []).length,
        };
      }
    });

    // Add semester-keyed selected counts
    Object.keys(localSelectedCoursesSemKey).forEach((semesterShortName) => {
      if (!summary.detailedCounts[semesterShortName]) {
        summary.detailedCounts[semesterShortName] = {
          available: 0,
          enrolled: 0,
          localSelected: 0,
        };
      }
      summary.detailedCounts[semesterShortName].semesterKeySelected = (
        localSelectedCoursesSemKey[semesterShortName] || []
      ).length;
    });

    return summary;
  };

  /**
   * Check if migration is needed by comparing old vs new data
   */
  const isMigrationNeeded = () => {
    const hasOldData =
      Object.keys(courseInfo).length > 0 ||
      Object.keys(enrolledCourses).length > 0 ||
      Object.keys(localSelectedCourses).length > 0;

    // Additional checks could be added here to see if unified data already exists
    return hasOldData;
  };

  return {
    migrateToUnifiedSystem,
    getMigrationSummary,
    isMigrationNeeded,
  };
}
