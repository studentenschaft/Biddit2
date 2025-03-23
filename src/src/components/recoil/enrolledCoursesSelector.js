import { selector } from "recoil";
import { allCourseInfoState } from "./allCourseInfosSelector";
import { selectedSemesterIndexAtom } from "./selectedSemesterAtom";

export const enrolledCoursesSelector = selector({
  key: "enrolledCoursesSelector",
  get: ({ get }) => {
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
      if (adjustedSemester + 1 === allCourseInfo.length) {
        adjustedSemester = 2;
      }
      if (adjustedSemester + 1 === allCourseInfo.length - 1) {
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
