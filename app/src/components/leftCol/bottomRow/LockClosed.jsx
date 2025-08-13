import PropTypes from "prop-types";
import { useMemo } from "react";
import { useRecoilValue } from "recoil";
import { calendarEntriesSelector } from "../../recoil/calendarEntriesSelector";

export default function LockClosed({ clg, event }) {
  const calendarEntries = useRecoilValue(calendarEntriesSelector);

  const computedColor = useMemo(() => {
    const COLOR_MAIN = "#006625"; // green
    const COLOR_WARNING = "#FCA311"; // orange
    // Closed lock means enrolled; default to green when unsure
    if (!event) return COLOR_MAIN;

    const courseNumber =
      event?.courses?.[0]?.courseNumber || event?.courseNumber || null;
    const hasOverlap = courseNumber
      ? calendarEntries.some(
          (e) => e.courseNumber === courseNumber && e.overlapping
        )
      : false;

    // Never gray: orange if overlapping, else green
    return hasOverlap ? COLOR_WARNING : COLOR_MAIN;
  }, [calendarEntries, event]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={clg}
      style={{ color: computedColor }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

LockClosed.propTypes = {
  clg: PropTypes.string.isRequired,
  event: PropTypes.object,
};

export { LockClosed };
