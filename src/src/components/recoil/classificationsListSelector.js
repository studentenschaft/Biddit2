import { selector } from "recoil";
import { allCourseInfoState } from "./allCourseInfosSelector";

export const classificationsListSelector = selector({
  key: "classificationsListSelector",
  get: ({ get }) => {
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
