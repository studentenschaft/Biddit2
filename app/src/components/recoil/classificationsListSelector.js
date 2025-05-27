import { selector } from "recoil";
import { allCourseInfoState } from "./allCourseInfosSelector";
import { allSemesterCoursesSelector } from "./unifiedCourseDataSelectors";

export const classificationsListSelector = selector({
  key: "classificationsListSelector",
  get: ({ get }) => {
    // Try unified system first, fallback to old system
    try {
      const unifiedCourses = get(allSemesterCoursesSelector);
      if (unifiedCourses && Object.keys(unifiedCourses).length > 0) {
        const classifications = new Set();
        Object.values(unifiedCourses).forEach((semesterData) => {
          // Check both available and enrolled courses
          const allCoursesInSemester = [
            ...(semesterData.available || []),
            ...(semesterData.enrolled || []),
            ...(semesterData.selected || []),
          ];
          allCoursesInSemester.forEach((course) => {
            if (course.classification)
              classifications.add(course.classification);
          });
        });
        if (classifications.size > 0) {
          return Array.from(classifications);
        }
      }
    } catch (error) {
      console.warn(
        "Unified course data not available, falling back to old system",
        error
      );
    }

    // Fallback to old system
    const allCourseInfo = get(allCourseInfoState);
    const classifications = new Set();

    Object.keys(allCourseInfo).forEach((semester) => {
      allCourseInfo[semester].forEach((course) => {
        classifications.add(course.classification);
      });
    });

    return Array.from(classifications);
  },
});
