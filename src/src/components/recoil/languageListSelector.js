import { selector } from "recoil";
import { allCourseInfoState } from "./allCourseInfosSelector";

export const languageListSelector = selector({
  key: "languageListSelector",
  get: ({ get }) => {
    const allCourseInfo = get(allCourseInfoState);
    const languages = new Set();

    Object.keys(allCourseInfo).forEach((semester) => {
      allCourseInfo[semester].forEach((course) => {
        languages.add(course.courseLanguage.code);
      });
    });

    return Array.from(languages);
  },
});
