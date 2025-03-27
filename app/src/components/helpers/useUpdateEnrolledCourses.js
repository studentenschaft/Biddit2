import { useRecoilState } from "recoil";
import { enrolledCoursesState } from "../recoil/enrolledCoursesAtom";

// Hook to return a function that updates the event list for the selected semester
export default function useUpdateEnrolledCoursesAtom() {
  const [, setEnrolled] = useRecoilState(enrolledCoursesState);

  const updateEnrolledCourses = (newEvents, index) => {
    setEnrolled((prevState) => ({
      ...prevState,
      [index]: newEvents, // Update the specific semester with the new events
    }));
  };

  return updateEnrolledCourses; // Return the updater function
}

export { useUpdateEnrolledCoursesAtom };
