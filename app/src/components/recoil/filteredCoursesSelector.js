import { selector } from "recoil";
import { allCourseInfoState } from "./allCourseInfosSelector";
import { selectionOptionsState } from "./selectionOptionsAtom";
import { selectedCourseIdsAtom } from "./selectedCourseIdsAtom";
import { allSemesterCoursesSelector } from "./unifiedCourseDataSelectors";

export const filteredCoursesSelector = selector({
  key: "filteredCoursesSelector",
  get: ({ get }) => {
    const selectionOptions = get(selectionOptionsState);
    const selectedCourseIds = get(selectedCourseIdsAtom); // Try unified system first
    try {
      const unifiedCourses = get(allSemesterCoursesSelector);
      if (unifiedCourses && Object.keys(unifiedCourses).length > 0) {
        const filteredCourses = {};

        Object.keys(unifiedCourses).forEach((semesterKey) => {
          const semesterData = unifiedCourses[semesterKey];
          // Use available courses from unified data structure
          const coursesToFilter = semesterData.available || [];

          if (coursesToFilter.length > 0) {
            const filtered = coursesToFilter.filter((course) => {
              return applyFilterCriteria(course, selectionOptions);
            });

            // Sort and mark selected courses
            filteredCourses[semesterKey] = sortAndMarkSelectedCourses(
              filtered,
              selectedCourseIds
            );
          } else {
            filteredCourses[semesterKey] = [];
          }
        });

        return filteredCourses;
      }
    } catch (error) {
      console.warn(
        "Unified course data not available, falling back to old system",
        error
      );
    }

    // Fallback to old system
    const allCourses = get(allCourseInfoState);
    const filteredCourses = {};
    Object.keys(allCourses).forEach((semester) => {
      // First filter courses based on criteria
      const filtered = allCourses[semester].filter((course) => {
        return applyFilterCriteria(course, selectionOptions);
      });

      // Sort and mark selected courses
      filteredCourses[semester] = sortAndMarkSelectedCourses(
        filtered,
        selectedCourseIds
      );
    });

    return filteredCourses;
  },
});

// Helper function to apply filter criteria
function applyFilterCriteria(course, selectionOptions) {
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
}

// Helper function to sort and mark selected courses
function sortAndMarkSelectedCourses(courses, selectedCourseIds) {
  return courses.sort((a, b) => {
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
}
