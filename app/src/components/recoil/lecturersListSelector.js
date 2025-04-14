import { selector } from "recoil";
import { courseInfoState } from "./courseInfoAtom";

export const lecturersListSelector = selector({
  key: "lecturersListSelector",
  get: ({ get }) => {
    const courseInfo = get(courseInfoState);
    const lecturersList = new Set();

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
                console.error('lecturersList: No displayName found in the data for lecturer: ', lecturer);
              }
            });
          } else {
            console.error('lecturersList: No lecturers array found in the data for course: ', course);
          }
        } else {
          console.error('lecturersList: No courses element found in the data for course: ', course);
        }
      });
    });

    return Array.from(lecturersList);
  },
});
