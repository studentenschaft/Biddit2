import { selector } from "recoil";
import { allSemesterCoursesSelector } from "./unifiedCourseDataSelectors";

export const languageListSelector = selector({
  key: "languageListSelector",
  get: ({ get }) => {
    const languages = new Set();
    const unifiedCourses = get(allSemesterCoursesSelector);

    if (unifiedCourses && Object.keys(unifiedCourses).length > 0) {
      Object.values(unifiedCourses).forEach((semesterData) => {
        // Check both available and enrolled courses
        const allCoursesInSemester = [
          ...(semesterData.available || []),
          ...(semesterData.enrolled || []),
          ...(semesterData.selected || []),
        ];
        allCoursesInSemester.forEach((course) => {
          if (course.courseLanguage && course.courseLanguage.code) {
            languages.add(course.courseLanguage.code);
          }
        });
      });
    }

    return Array.from(languages);
  },
});
