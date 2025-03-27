import { selector } from "recoil";
import { allCourseInfoState } from "./allCourseInfosSelector";
import { selectionOptionsState } from "./selectionOptionsAtom";

export const filteredCoursesSelector = selector({
  key: "filteredCoursesSelector",
  get: ({ get }) => {
    const allCourses = get(allCourseInfoState);
    const selectionOptions = get(selectionOptionsState);

    const filteredCourses = {};
    Object.keys(allCourses).forEach((semester) => {
      filteredCourses[semester] = allCourses[semester].filter((course) => {
        const classifications = selectionOptions.classifications;
        const ects = selectionOptions.ects;
        // const lecturers = selectionOptions.lecturers;
        const ratings = selectionOptions.ratings;
        const courseLanguage = selectionOptions.courseLanguage;
        const lecturer = selectionOptions.lecturer;
        const searchTerm = selectionOptions.searchTerm;

        if (
          classifications.length > 0 &&
          !classifications.includes(course.classification)
        ) {
          return false;
        }

        if (ects.length > 0 && !ects.includes(course.credits)) {
          return false;
        }

        if (
          lecturer.length > 0 &&
          course.courses[0] &&
          course.courses[0].lecturers &&
          !course.courses[0].lecturers.some((lect) =>
            lecturer.includes(lect.displayName)
          )
        ) {
          return false;
        }

        if (ratings.length > 0 && course.avgRating < Math.max(...ratings)) {
          return false;
        }

        if (
          courseLanguage.length > 0 &&
          !courseLanguage.includes(course.courseLanguage.code)
        ) {
          return false;
        }

        if (
          searchTerm.length > 0 &&
          !course.shortName.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          return false;
        }

        return true;
      });
    });

    return filteredCourses;
  },
});
