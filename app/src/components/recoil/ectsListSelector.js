import { selector } from "recoil";
import { allCourseInfoState } from "./allCourseInfosSelector";

export const ectsListSelector = selector({
  key: "ectsListSelector",
  get: ({ get }) => {
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
