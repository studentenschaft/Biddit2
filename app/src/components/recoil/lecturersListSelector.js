import { selector } from "recoil";
import { courseInfoState } from "./courseInfoAtom";
import { allSemesterCoursesSelector } from "./unifiedCourseDataSelectors";

export const lecturersListSelector = selector({
  key: "lecturersListSelector",
  get: ({ get }) => {
    const lecturersList = new Set(); // Try unified system first
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
            // Check if course.courses exists and has at least one element
            if (course.courses && course.courses.length > 0) {
              // Check if the first course has a lecturers array
              const lecturers = course.courses[0].lecturers;
              if (Array.isArray(lecturers)) {
                lecturers.forEach((lecturer) => {
                  if (lecturer && lecturer.displayName) {
                    lecturersList.add(lecturer.displayName);
                  }
                });
              }
            }
          });
        });

        if (lecturersList.size > 0) {
          return Array.from(lecturersList);
        }
      }
    } catch (error) {
      console.warn(
        "Unified course data not available, falling back to old system",
        error
      );
    }

    // Fallback to old system
    const courseInfo = get(courseInfoState);

    Object.keys(courseInfo).forEach((semester) => {
      courseInfo[semester].forEach((course) => {
        // Check if course.courses exists and has at least one element
        if (course.courses && course.courses.length > 0) {
          // Check if the first course has a lecturers array
          const lecturers = course.courses[0].lecturers;
          if (Array.isArray(lecturers)) {
            lecturers.forEach((lecturer) => {
              if (lecturer && lecturer.displayName) {
                lecturersList.add(lecturer.displayName);
              } else {
                console.error(
                  "lecturersList: No displayName found in the data for lecturer: ",
                  lecturer
                );
              }
            });
          } else {
            console.error(
              "lecturersList: No lecturers array found in the data for course: ",
              course
            );
          }
        } else {
          console.error(
            "lecturersList: No courses element found in the data for course: ",
            course
          );
        }
      });
    });

    return Array.from(lecturersList);
  },
});
