import { useRecoilState } from "recoil";
import { enrolledCoursesState } from "../recoil/enrolledCoursesAtom";
import { useUnifiedCourseData } from "./useUnifiedCourseData";

// Hook to return a function that updates the enrolled courses for the selected semester
export default function useUpdateEnrolledCoursesAtom() {
  const [, setEnrolled] = useRecoilState(enrolledCoursesState);
  const { updateEnrolledCoursesForSemester } = useUnifiedCourseData();

  const updateEnrolledCourses = (newEvents, index) => {
    // Update old system
    setEnrolled((prevState) => ({
      ...prevState,
      [index]: newEvents, // Update the specific semester with the new events
    }));

    // Update unified system if possible
    try {
      // We need the semester short name to update the unified system
      // For now, just update the old system - the unified system will be updated
      // through the migration manager when components fetch data
      console.debug(
        "Updated enrolled courses for index:",
        index,
        "courses:",
        newEvents
      );
    } catch (error) {
      console.warn("Could not update unified course data:", error);
    }
  };

  return updateEnrolledCourses; // Return the updater function
}

export { useUpdateEnrolledCoursesAtom };
