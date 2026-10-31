import { useSetRecoilState } from "recoil";
import { trackCourseDetailsOpened } from "./analytics";
import { selectedTabAtom } from "../recoil/selectedTabAtom";
import { courseDetailsSemesterAtom } from "../recoil/courseDetailsSemesterAtom";
import { TAB } from "../../constants/tabs";
import { useUnifiedCourseData } from "./useUnifiedCourseData";

/**
 * Single entry point for "show this course's details".
 * Owns the navigation policy so a future layout change (e.g. a drawer)
 * only has to change this hook, not every caller.
 *
 * `semester` names the semester the course was opened for, when the caller
 * knows it (the curriculum map); see `courseDetailsSemesterAtom`.
 */
export function useOpenCourseDetails() {
  const setSelectedTab = useSetRecoilState(selectedTabAtom);
  const setOpenedForSemester = useSetRecoilState(courseDetailsSemesterAtom);
  const { updateSelectedCourseInfo } = useUnifiedCourseData();

  return (course, { source = "unknown", semester = null } = {}) => {
    if (!course) return;
    updateSelectedCourseInfo(course);
    // Set on every open, so a caller that names no semester never inherits
    // the previous caller's.
    setOpenedForSemester(semester);
    setSelectedTab(TAB.COURSE_DETAILS);
    trackCourseDetailsOpened(source);
  };
}
