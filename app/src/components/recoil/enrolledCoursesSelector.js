import { selector } from "recoil";
import { allCourseInfoState } from "./allCourseInfosSelector";
import { selectedSemesterIndexAtom } from "./selectedSemesterAtom";
import { enrolledCoursesSelector as unifiedEnrolledCoursesSelector } from "./unifiedCourseDataSelectors";

export const enrolledCoursesSelector = selector({
  key: "enrolledCoursesSelector",
  get: ({ get }) => {
    // Try unified system first
    try {
      const unifiedEnrolledCourses = get(unifiedEnrolledCoursesSelector);
      if (unifiedEnrolledCourses && unifiedEnrolledCourses.length > 0) {
        return unifiedEnrolledCourses;
      }
    } catch (error) {
      console.warn(
        "Unified enrolled courses not available, falling back to old system",
        error
      );
    }

    // Fallback to old system
    const allCourseInfo = get(allCourseInfoState);
    const selectedSemester = get(selectedSemesterIndexAtom);
    let adjustedSemester = selectedSemester;
    let currCourses = [];

    if (allCourseInfo[adjustedSemester + 1]) {
      currCourses = allCourseInfo[adjustedSemester + 1].filter(
        (course) => course.enrolled || course.selected
      );
    } else {
      console.warn("Future semester (projection) selected");
      console.warn("index", adjustedSemester + 1);
      if (adjustedSemester + 1 === Object.keys(allCourseInfo).length) {
        adjustedSemester = 2;
      }
      if (adjustedSemester + 1 === Object.keys(allCourseInfo).length - 1) {
        adjustedSemester = 1;
      }
      if (allCourseInfo[adjustedSemester + 1]) {
        currCourses = allCourseInfo[adjustedSemester + 1].filter(
          (course) => course.enrolled || course.selected
        );
      }
    }
    return currCourses;
  },
});
