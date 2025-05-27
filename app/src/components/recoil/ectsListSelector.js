import { selector } from "recoil";
import { allCourseInfoState } from "./allCourseInfosSelector";
import { allSemesterCoursesSelector } from "./unifiedCourseDataSelectors";

export const ectsListSelector = selector({
  key: "ectsListSelector",
  get: ({ get }) => {
    // Try unified system first, fallback to old system
    try {
      const unifiedCourses = get(allSemesterCoursesSelector);
      if (unifiedCourses && Object.keys(unifiedCourses).length > 0) {
        const ects = new Set();
        Object.values(unifiedCourses).forEach((semesterData) => {
          // Check both available and enrolled courses
          const allCoursesInSemester = [
            ...(semesterData.available || []),
            ...(semesterData.enrolled || []),
            ...(semesterData.selected || []),
          ];
          allCoursesInSemester.forEach((course) => {
            if (course.credits) ects.add(course.credits);
          });
        });
        if (ects.size > 0) {
          return Array.from(ects);
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
    const ects = new Set();

    Object.keys(allCourseInfo).forEach((semester) => {
      allCourseInfo[semester].forEach((course) => {
        ects.add(course.credits);
      });
    });

    return Array.from(ects);
  },
});
