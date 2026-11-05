import { useRecoilValue } from "recoil";
import {
  unifiedCourseDataState,
  initializedSemestersState,
} from "../recoil/unifiedCourseDataAtom";
import {
  DEFAULT_SEMESTER_STRUCTURE,
  useUnifiedCourseDataWriters,
} from "./useUnifiedCourseDataWriters";

/**
 * Read and write access to the unified course data atom.
 *
 * Subscribes to the whole atom, so the host re-renders on every change. Hooks
 * that only write should use useUnifiedCourseDataWriters instead.
 */
export function useUnifiedCourseData() {
  const courseData = useRecoilValue(unifiedCourseDataState);
  const initializedSemesters = useRecoilValue(initializedSemestersState);
  const writers = useUnifiedCourseDataWriters();

  /**
   * Get data for a specific semester
   */
  const getSemesterData = (semesterShortName) => {
    return (
      (courseData.semesters && courseData.semesters[semesterShortName]) ||
      DEFAULT_SEMESTER_STRUCTURE
    );
  };

  /**
   * Check if a semester needs data refresh (based on lastFetched time)
   */
  const needsRefresh = (semesterShortName, maxAgeMinutes = 30) => {
    const semesterData = getSemesterData(semesterShortName);
    if (!semesterData.lastFetched) return true;

    const lastFetched = new Date(semesterData.lastFetched);
    const now = new Date();
    const ageMinutes = (now - lastFetched) / (1000 * 60);

    return ageMinutes > maxAgeMinutes;
  };

  return {
    courseData,
    initializedSemesters,
    ...writers,
    getSemesterData,
    needsRefresh,
  };
}
