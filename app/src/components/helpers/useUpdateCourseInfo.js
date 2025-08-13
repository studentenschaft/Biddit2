import { useRecoilState } from "recoil";
import { courseInfoState } from "../recoil/courseInfoAtom";
import { useUnifiedCourseData } from "./useUnifiedCourseData";

// Hook to return a function that updates the course info
export default function useUpdateCourseInfoAtom() {
  const [, setCourseInfo] = useRecoilState(courseInfoState);
  const { updateAvailableCoursesForSemester } = useUnifiedCourseData();

  const updateCourseInfo = (newInfo, index) => {
    // Update old system
    setCourseInfo((prevState) => ({
      ...prevState,
      [index]: newInfo, // Update the specific course info with the new info
    }));

    // Update unified system if possible
    try {
      // We need the semester short name to update the unified system
      // For now, just update the old system - the unified system will be updated
      // through the migration manager when components fetch data
      console.debug(
        "Updated course info for index:",
        index,
        "courses:",
        newInfo
      );
    } catch (error) {
      console.warn("Could not update unified course data:", error);
    }
  };

  return updateCourseInfo; // Return the updater function
}

export { useUpdateCourseInfoAtom };
