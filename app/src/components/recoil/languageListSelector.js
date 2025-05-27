import { selector } from "recoil";
import { allCourseInfoState } from "./allCourseInfosSelector";
import { allSemesterCoursesSelector } from "./unifiedCourseDataSelectors";

export const languageListSelector = selector({
  key: "languageListSelector",
  get: ({ get }) => {
    const languages = new Set(); // Try unified system first
    try {
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

        if (languages.size > 0) {
          return Array.from(languages);
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

    Object.keys(allCourseInfo).forEach((semester) => {
      allCourseInfo[semester].forEach((course) => {
        if (course.courseLanguage && course.courseLanguage.code) {
          languages.add(course.courseLanguage.code);
        }
      });
    });

    return Array.from(languages);
  },
});
