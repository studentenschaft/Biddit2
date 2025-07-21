import { selector } from "recoil";
import { allSemesterCoursesSelector } from "./unifiedCourseDataSelectors";

export const classificationsListSelector = selector({
  key: "classificationsListSelector",
  get: ({ get }) => {
    const unifiedCourses = get(allSemesterCoursesSelector);
    const classifications = new Set();

    if (unifiedCourses && Object.keys(unifiedCourses).length > 0) {
      Object.values(unifiedCourses).forEach((semesterData) => {
        // Check both available and enrolled courses
        const allCoursesInSemester = [
          ...(semesterData.available || []),
          ...(semesterData.enrolled || []),
          ...(semesterData.selected || []),
        ];
        allCoursesInSemester.forEach((course) => {
          if (course.classification) classifications.add(course.classification);
        });
      });
    }

    return Array.from(classifications);
  },
});
