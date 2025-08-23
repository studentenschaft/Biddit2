import { selector } from "recoil";
import { allSemesterCoursesSelector } from "./unifiedCourseDataSelectors";

export const ectsListSelector = selector({
  key: "ectsListSelector",
  get: ({ get }) => {
    const unifiedCourses = get(allSemesterCoursesSelector);
    const ects = new Set();

    if (unifiedCourses && Object.keys(unifiedCourses).length > 0) {
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
    }

    return Array.from(ects);
  },
});
