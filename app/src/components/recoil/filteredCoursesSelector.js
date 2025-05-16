import { selector } from "recoil";
import { allCourseInfoState } from "./allCourseInfosSelector";
import { selectionOptionsState } from "./selectionOptionsAtom";
import { selectedCourseIdsAtom } from "./selectedCourseIdsAtom";

export const filteredCoursesSelector = selector({
  key: "filteredCoursesSelector",
  get: ({ get }) => {
    const allCourses = get(allCourseInfoState);
    const selectionOptions = get(selectionOptionsState);
    const selectedCourseIds = get(selectedCourseIdsAtom);

    const filteredCourses = {};
    Object.keys(allCourses).forEach((semester) => {
      // First filter courses based on criteria
      const filtered = allCourses[semester].filter((course) => {
        const classifications = selectionOptions.classifications;
        const ects = selectionOptions.ects;
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

      // Then sort them with selected courses at the top
      filteredCourses[semester] = filtered.sort((a, b) => {
        const aSelected =
          selectedCourseIds.includes(a.id) ||
          selectedCourseIds.includes(a.courseNumber);
        const bSelected =
          selectedCourseIds.includes(b.id) ||
          selectedCourseIds.includes(b.courseNumber);

        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return 0;
      });
    });

    return filteredCourses;
  },
});
