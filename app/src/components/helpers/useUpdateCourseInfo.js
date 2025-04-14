import { useRecoilState } from "recoil";
import { courseInfoState } from "../recoil/courseInfoAtom";

// Hook to return a function that updates the course info
export default function useUpdateCourseInfoAtom() {
  const [, setCourseInfo] = useRecoilState(courseInfoState);

  const updateCourseInfo = (newInfo, index) => {
    setCourseInfo((prevState) => ({
      ...prevState,
      [index]: newInfo, // Update the specific course info with the new info
    }));
  };

  return updateCourseInfo; // Return the updater function
}

export { useUpdateCourseInfoAtom };
