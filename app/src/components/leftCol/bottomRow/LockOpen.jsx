// LockOpen.jsx //

import PropTypes from "prop-types";
import { useMemo, useState } from "react";
import { useRecoilValue } from "recoil";
import { authTokenState } from "../../recoil/authAtom";
import {
  selectedSemesterSelector,
  selectedCoursesSelector,
} from "../../recoil/unifiedCourseDataSelectors";

import { useCourseSelection } from "../../helpers/useCourseSelection";
import { calendarEntriesSelector } from "../../recoil/calendarEntriesSelector";
/**
 * LockOpen Component
 * Renders an open lock icon that toggles a course in or out of the user’s study plan
 */
export default function LockOpen({ clg, event }) {
  // Recoil states (NO LOCAL STATE)
  const authToken = useRecoilValue(authTokenState);
  const selectedSemesterShortName = useRecoilValue(selectedSemesterSelector);
  const calendarEntries = useRecoilValue(calendarEntriesSelector);
  const [isHovered, setIsHovered] = useState(false);
  const selectedCourseIdsRaw = useRecoilValue(
    selectedCoursesSelector(selectedSemesterShortName || "")
  );
  const selectedCourseIds = useMemo(
    () => selectedCourseIdsRaw || [],
    [selectedCourseIdsRaw]
  );

  const { addOrRemoveCourse } = useCourseSelection({
    selectedCourseIds,
    setSelectedCourseIds: null, // unified hook updates global state directly
    selectedSemesterShortName: selectedSemesterShortName || "",
    authToken,
  });

  // Compute smart color based on event state
  const computedColor = useMemo(() => {
    const COLOR_MAIN = "#006625"; // green
    const COLOR_WARNING = "#FCA311"; // orange
    const COLOR_GRAY = "#9CA3AF"; // gray
    const COLOR_DANGER = "#DC2626"; // red-600

    if (!event) return COLOR_GRAY;

    const courseNumber =
      event?.courses?.[0]?.courseNumber || event?.courseNumber || null;
    const isSelected =
      !!event?.selected ||
      (courseNumber ? selectedCourseIds.includes(courseNumber) : false);
    const isEnrolled = !!event?.enrolled;

    // Determine overlap from calendar entries
    const hasOverlap = courseNumber
      ? calendarEntries.some(
          (e) => e.courseNumber === courseNumber && e.overlapping
        )
      : false;

    // On hover, indicate deletion clearly for selected (removal) items
    if (isHovered && isSelected && !isEnrolled) return COLOR_DANGER;
    if (isEnrolled) return COLOR_MAIN;
    if (isSelected && hasOverlap) return COLOR_WARNING;
    if (isSelected) return COLOR_MAIN;
    return COLOR_GRAY; // not selected (e.g., SimilarCourses): gray
  }, [calendarEntries, event, selectedCourseIds, isHovered]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={clg + " transition duration-500 ease-in-out"}
      style={{ color: computedColor }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={(e) => {
        e.preventDefault();
        event
          ? addOrRemoveCourse(event)
          : console.log("no event to lock/unlock");
      }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

LockOpen.propTypes = {
  clg: PropTypes.string.isRequired,
  event: PropTypes.object,
};

export { LockOpen };
