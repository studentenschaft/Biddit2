import { useSetRecoilState } from "recoil";
import { trackCourseDetailsOpened } from "./analytics";
import { selectedTabAtom } from "../recoil/selectedTabAtom";
import { TAB } from "../../constants/tabs";
import { useUnifiedCourseData } from "./useUnifiedCourseData";

/**
 * Single entry point for "show this course's details".
 * Owns the navigation policy so a future layout change (e.g. a drawer)
 * only has to change this hook, not every caller.
 */
export function useOpenCourseDetails() {
  const setSelectedTab = useSetRecoilState(selectedTabAtom);
  const { updateSelectedCourseInfo } = useUnifiedCourseData();

  return (course, { source = "unknown" } = {}) => {
    if (!course) return;
    updateSelectedCourseInfo(course);
    setSelectedTab(TAB.COURSE_DETAILS);
    trackCourseDetailsOpened(source);
  };
}
