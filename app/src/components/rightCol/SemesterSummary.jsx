// import PropTypes from "prop-types";
import { useState } from "react";
import { useRecoilValue } from "recoil";
import { Tooltip as ReactTooltip } from "react-tooltip";

// Import unified selectors
import {
  myCoursesSelector,
  selectedSemesterSelector,
} from "../recoil/unifiedCourseDataSelectors";

import { calendarEntriesSelector } from "../recoil/calendarEntriesSelector";

import { LockOpen } from "../leftCol/bottomRow/LockOpen";
import { LockClosed } from "../leftCol/bottomRow/LockClosed";
import { useOpenCourseDetails } from "../helpers/useOpenCourseDetails";
import { formatEcts } from "../helpers/formatEcts";

import { Heatmap } from "./Heatmap";

//TODO: fix missing reactivity of course list when selected courses change + found bug where fake overlap is shown (also on current prod)

/**
 * The column template every row of the summary shares.
 *
 * `grid-cols-12 gap-4` alone could not survive a phone: at 390px the eleven
 * 16px gaps ate 176 of the ~342 available pixels, leaving twelve tracks of
 * ~14px. "Events" and "ECTS" each occupy one of those tracks and had nothing
 * clipping them, so both labels overflowed their track and painted on top of
 * each other — the reported "EvenBCTS". Below md the numeric columns therefore
 * get fixed tracks wide enough for their own headers, the text columns get
 * `minmax(0, …fr)` so they truncate instead of pushing, and the gap shrinks.
 * From md up the original twelve-column layout is restored untouched.
 */
const ROW_GRID_CLASSES =
  "grid grid-cols-[auto_minmax(0,1fr)_minmax(0,0.9fr)_3.5rem_3rem] gap-2 md:grid-cols-12 md:gap-4";


export default function SemesterSummary() {
  const openCourseDetails = useOpenCourseDetails();
  const [courseOnDay, setCourseOnDay] = useState([]);
  const [hoveredDate, setHoveredDate] = useState(null);
  const [hoveredCourse, setHoveredCourse] = useState(null);

  // Get calendar entries for conflict detection
  const calendarEntries = useRecoilValue(calendarEntriesSelector);

  // Use unified course data system - get selected semester from selector
  const selectedSemesterState = useRecoilValue(selectedSemesterSelector);

  // The user's courses (enrolled ∪ selected) — same source as the calendar,
  // so the table and the schedule cannot drift apart.
  const currCourses = useRecoilValue(myCoursesSelector(selectedSemesterState));

  const totalCredits = currCourses.reduce((acc, curr) => {
    return acc + curr.credits / 100;
  }, 0);

  const totalEvents = currCourses.reduce((acc, curr) => {
    return acc + (curr.calendarEntry?.length || 0);
  }, 0);

  // Get all unique courses that conflict with this course
  function getConflictsForCourse(course) {
    if (!course?.courseNumber) return [];
    const conflicts = new Set();
    calendarEntries.forEach((entry) => {
      if (
        entry.courseNumber === course.courseNumber &&
        entry.conflictsWith &&
        entry.conflictsWith.length > 0
      ) {
        entry.conflictsWith.forEach((name) => conflicts.add(name));
      }
    });
    return Array.from(conflicts);
  }

  function courseSelector(fullEvent) {
    openCourseDetails(fullEvent, { source: "semester-summary" });
  }

  function checkIfCourseOnDay(course) {
    for (let i = 0; i < courseOnDay.length; i++) {
      if (
        (course.courses &&
          course.courses.length > 0 &&
          courseOnDay[i] === course.courses[0].courseNumber) ||
        (!course.courses && courseOnDay[i] === course.courseNumber)
      ) {
        return true;
      }
    }
    return false;
  }

  // Helper function to shift event dates for future semesters
  function getShiftedEventDate(originalDate, targetYear) {
    const shifted = new Date(originalDate);
    const originalYear = shifted.getFullYear();
    const yearDiff = targetYear - originalYear;

    if (yearDiff !== 0) {
      shifted.setFullYear(targetYear);

      // If the original date doesn't exist in the target year (e.g., Feb 29), adjust
      if (shifted.getMonth() !== originalDate.getMonth()) {
        shifted.setDate(0); // Go to last day of previous month
      }
    }

    return shifted;
  }

  function returnEventOfThatDay(course) {
    if (
      !course.calendarEntry ||
      course.calendarEntry.length === 0 ||
      !hoveredDate
    ) {
      // fix if calendarEntry is empty or no hoveredDate
      return null;
    }

    // Get target year from hoveredDate for future semester date shifting
    const targetYear = hoveredDate.getFullYear();

    for (let i = 0; i < course.calendarEntry.length; i++) {
      const entry = course.calendarEntry[i];
      if (!entry.eventDate) {
        continue; // Skip entries with empty eventDate
      }

      // Shift event date to match the target year (for future semesters)
      const originalEventDate = new Date(entry.eventDate);
      const shiftedEventDate = getShiftedEventDate(
        originalEventDate,
        targetYear
      );

      if (
        shiftedEventDate.getDate() === hoveredDate.getDate() &&
        shiftedEventDate.getMonth() === hoveredDate.getMonth() &&
        shiftedEventDate.getFullYear() === hoveredDate.getFullYear()
      ) {
        let starttimeString = "N/A";
        let endtimeString = "N/A";

        try {
          starttimeString =
            shiftedEventDate.toLocaleTimeString("locale", {
              hour: "2-digit",
              minute: "2-digit",
            }) || "N/A";

          endtimeString =
            new Date(
              shiftedEventDate.getTime() +
                (entry.durationInMinutes || 0) * 60000
            ).toLocaleTimeString("locale", {
              hour: "2-digit",
              minute: "2-digit",
            }) || "N/A";
        } catch (error) {
          console.error("Error formatting time:", error);
        }

        return {
          ...entry,
          starttimeString,
          endtimeString,
        };
      }
    }
    return null;
  }

  if (currCourses.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-4 text-sm font-medium text-center text-gray-500 align-middle md:text-base">
        You have no allocated or selected courses. Browse the course list on the
        left and click + to start planning your semester.
      </div>
    );
  } else {
    return (
      <div className="w-full px-4 py-5 sm:p-6">
        {/* Tooltip for conflict information */}
        <ReactTooltip
          id="conflict-tooltip"
          style={{ zIndex: 9999, maxWidth: "min(320px, 85vw)" }}
          render={({ activeAnchor }) => {
            const conflicts = activeAnchor?.getAttribute("data-conflicts");
            if (!conflicts) return null;
            const conflictList = conflicts.split(", ");
            return (
              <div className="text-amber-300">
                <div className="font-medium">⚠ Conflicts with:</div>
                <ul className="list-disc list-inside text-sm">
                  {conflictList.map((course, idx) => (
                    <li key={idx} className="truncate">{course}</li>
                  ))}
                </ul>
              </div>
            );
          }}
        />
        <Heatmap
          hovered={hoveredCourse}
          setCourseOnDay={setCourseOnDay}
          hoveredDate={hoveredDate}
          setHoveredDate={setHoveredDate}
        />
        <div className="w-full h-full">
          <div
            className={`${ROW_GRID_CLASSES} px-2 py-1 pb-2 text-sm font-semibold text-gray-900 rounded`}
          >
            <div className="text-center"></div>
            <div className="min-w-0 truncate md:col-span-6">Course</div>

            <div className="min-w-0 truncate md:col-span-3">Classification</div>
            {/* whitespace-nowrap: these two must never wrap or spill into one
                another, so their tracks are sized for the labels as one line. */}
            <div className="text-center whitespace-nowrap">Events</div>
            <div className="text-center whitespace-nowrap">ECTS</div>
          </div>
          <div className="inline-block w-full h-full min-w-full align-middle">
            <div className="ring-1 ring-black ring-opacity-5 md:rounded-lg ">
              {currCourses.map((course, index) => {
                const conflicts = getConflictsForCourse(course);
                const hasConflicts = conflicts.length > 0;
                return (
                  <div
                    key={index}
                    className={`${ROW_GRID_CLASSES} px-2 py-1 text-sm text-gray-900 rounded group hover:bg-gray-300 ${
                      checkIfCourseOnDay(course) ? "bg-gray-300" : ""
                    }`}
                    onMouseEnter={() => {
                      setHoveredCourse(course);
                    }}
                    onMouseLeave={() => {
                      setHoveredCourse(null);
                    }}
                  >
                    <div
                      className="text-center"
                      data-tooltip-id={hasConflicts ? "conflict-tooltip" : undefined}
                      data-conflicts={hasConflicts ? conflicts.join(", ") : undefined}
                    >
                      <div
                        className={`flex justify-center items-center align-center h-full ${
                          course && course.overlapping
                            ? "border-warning text-warning cursor-pointer"
                            : course.enrolled
                            ? " border-main text-main cursor-not-allowed"
                            : course.selected
                            ? "border-main text-main cursor-pointer"
                            : ""
                        } ${
                          course && checkIfCourseOnDay(course)
                            ? "transform scale-110"
                            : ""
                        }`}
                      >
                        {course && course.enrolled ? (
                          <LockClosed clg="w-4 h-4 " />
                        ) : (
                          <LockOpen clg="w-4 h-4 " event={course} />
                        )}
                      </div>
                    </div>
                    <div
                      className="min-w-0 font-semibold truncate cursor-pointer md:col-span-6"
                      onClick={() => courseSelector(course)}
                    >
                      {course.shortName}

                      {checkIfCourseOnDay(course) && (
                        <div className="pt-1 text-xs font-thin truncate transition">
                          {(() => {
                            const eventDetails = returnEventOfThatDay(course);
                            return eventDetails
                              ? `from ${eventDetails.starttimeString} to ${eventDetails.endtimeString}`
                              : "Time not available";
                          })()}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 md:col-span-3">
                      <div className="truncate ">{course.classification}</div>
                    </div>
                    <div className="text-center">
                      <div className="">
                        {course.calendarEntry?.length || 0}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="">{formatEcts(course.credits / 100)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div
            className={`${ROW_GRID_CLASSES} px-2 py-1 pb-2 text-sm font-semibold text-gray-900 rounded`}
          >
            <div className="text-center truncate">Total</div>

            <div className="min-w-0 truncate md:col-span-6">
              {currCourses.length} Courses
            </div>
            <div className="min-w-0 text-center md:col-span-3"></div>
            <div className="text-center">{totalEvents}</div>
            {/* Five cells, matching the header and the rows. A sixth, empty one
                used to sit here and wrap onto a phantom second grid row. */}
            <div className="text-center relative">
              <span className={totalCredits > 30 ? "text-red-500" : ""}>
                {formatEcts(totalCredits)}
              </span>
              {totalCredits > 30 && (
                <div className=" mb-2 break-words text-gray-500 text-xs rounded py-1 px-2">
                  Warning: Exceeds recommended credit limit
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export { SemesterSummary };
