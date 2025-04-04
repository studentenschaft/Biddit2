// Heatmap.jsx //

import { useRecoilValue } from "recoil";
import { calendarEntriesSelector } from "../recoil/calendarEntriesSelector";
import PropTypes from "prop-types";
import { cisIdList as cisIdListAtom } from "../recoil/cisIdListAtom";
import { selectedSemesterIndexAtom } from "../recoil/selectedSemesterAtom";
import { selectedSemesterAtom } from "../recoil/selectedSemesterAtom";
import { isFutureSemesterSelected } from "../recoil/isFutureSemesterSelected";
import { useMemo, useCallback } from "react";

// Helper to get date from calendar week
// TODO: Cleanup: move into a helper funciton file
// Helper to get date from calendar week
function getDateOfISOWeek(week, year, getEndOfWeek = false) {
  // Simple formula to get first day of week
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;

  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());

  // For end of week, add 4 days to get to Friday
  if (getEndOfWeek) {
    ISOweekStart.setDate(ISOweekStart.getDate() + 4);
  }

  return ISOweekStart;
}

function getSemesterDates(cisTermData, selectedIndex, selectedSemShortName) {
  // Debug the inputs
  console.log("DEBUG Heatmap: getSemesterDates inputs:", { 
    cisTermData: cisTermData ? cisTermData.length : "No data", 
    selectedIndex, 
    selectedSemShortName 
  });
  
  const selectedSemester = cisTermData[selectedIndex];
  
  // Use the selected semester short name if provided, otherwise fall back to the semester from cisTermData
  const shortName = selectedSemShortName || selectedSemester?.shortName;
  console.log("DEBUG Heatmap: Using semester short name:", shortName);
  
  if (!shortName) {
    console.warn("DEBUG Heatmap: No short name available for semester, using current year");
    return {
      start: new Date(new Date().getFullYear(), 1, 1), // Default to current year
      end: new Date(new Date().getFullYear(), 11, 31)
    };
  }

  // Extract year from semester name (e.g. "FS24" -> "24")
  // Handles both "FS24" and "FS 24" formats by removing spaces first
  const cleanShortName = shortName.replace(/\s/g, '');
  const yearStr = cleanShortName.match(/\d+/)?.[0];
  
  // Convert to full year (e.g. "24" -> 2024)
  const year = yearStr ? 2000 + parseInt(yearStr) : new Date().getFullYear();

  // Check if spring semester
  const isSpring = cleanShortName.includes("FS");

  console.log(`DEBUG Heatmap: Processing semester ${shortName} for year ${year}, isSpring: ${isSpring}`);

  if (isSpring) {
    return {
      start: getDateOfISOWeek(8, year),
      end: getDateOfISOWeek(21, year, true),
    };
  } else {
    return {
      start: getDateOfISOWeek(38, year),
      end: getDateOfISOWeek(51, year, true),
    };
  }
}

// DEBUG test cases
// const spring = getSemesterDates([{shortName: 'FS25'}], 0);
// console.log("getsemdates: Spring semester:", {
//   start: spring.start.toDateString(), // Should be Monday of week 8
//   end: spring.end.toDateString()      // Should be Friday of week 21
// });

// const fall = getSemesterDates([{shortName: 'HS24'}], 0);
// console.log("getsemdates: Fall semester:", {
//   start: fall.start.toDateString(),   // Should be Monday of week 38
//   end: fall.end.toDateString()        // Should be Friday of week 51
// });

function getDateString(date) {
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

function getWeekNumber(d) {
  // Copy date so don't modify original
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // Get first day of year
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  var weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  // Return array of year and week number
  return [d.getUTCFullYear(), weekNo];
}

export const Heatmap = ({
  hovered,
  setCourseOnDay,
  hoveredDate,
  setHoveredDate,
}) => {
  const events = useRecoilValue(calendarEntriesSelector);

  const cisIdList = useRecoilValue(cisIdListAtom);
  const selectedIndex = useRecoilValue(selectedSemesterIndexAtom);
  const selectedSemesterShortName = useRecoilValue(selectedSemesterAtom);
  const isFutureSem = useRecoilValue(isFutureSemesterSelected);

  // Memoize semester dates
  const { start: semesterStartDate, end: semesterEndDate } = useMemo(() => {
    console.log("DEBUG Heatmap: Calculating semester dates"); // This will only run when dependencies change
    return getSemesterDates(cisIdList, selectedIndex, selectedSemesterShortName);
  }, [cisIdList, selectedIndex, selectedSemesterShortName]);

  // Memoize the dates array
  const dates = useMemo(() => {
    return getDatesInRange(semesterStartDate, semesterEndDate);
  }, [semesterStartDate, semesterEndDate]);

  // works correctly:
  //const semesterStartDate = new Date("2024-09-16"); // comment for future reference: this also needs to be changed for #changesemester
  //const semesterEndDate = new Date("2024-12-21"); // comment for future reference: this also needs to be changed for #changesemester

  // filter out the first numbers after " Biddingstart in der" to get reference for the dates
  // const biddingStart = cisIdList[0].footer

  // console.log("biddingStart", biddingStart);
  function checkIfHoveredDate(date) {
    // check if the date is the same as the hovered date
    if (
      hoveredDate &&
      hoveredDate.getDate() === date.getDate() &&
      hoveredDate.getMonth() === date.getMonth() &&
      hoveredDate.getFullYear() === date.getFullYear()
    ) {
      return true;
    }
    return false;
  }

  function checkIfEventsOverlap(date) {
    // find all events on the date and add them to an array
    const eventsOnDate = [];
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const eventDate = new Date(event.start);
      const eventEndDate = new Date(event.end);

      if (
        (eventDate.getDate() === date.getDate() &&
          eventDate.getMonth() === date.getMonth() &&
          eventDate.getFullYear() === date.getFullYear()) ||
        (eventEndDate.getDate() === date.getDate() &&
          eventEndDate.getMonth() === date.getMonth() &&
          eventEndDate.getFullYear() === date.getFullYear())
      ) {
        eventsOnDate.push(event);
      }
    }
    // check for each event if it overlaps with another event
    if (eventsOnDate.length === 0 || eventsOnDate.length === 1) {
      return false;
    }
    for (let i = 0; i < eventsOnDate.length; i++) {
      const event = eventsOnDate[i];

      for (let j = 0; j < eventsOnDate.length; j++) {
        const otherEvent = eventsOnDate[j];

        // check if event start time is smaller than other event start time and event end time is bigger than other event start time
        if (
          event.start <= otherEvent.start &&
          event.end >= otherEvent.start &&
          event !== otherEvent
        ) {
          return true;
        }
      }
    }
    return false;
  }

  function getDatesInRange(startDate, endDate) {
    const date = new Date(startDate.getTime());

    const dates = [];

    while (date <= endDate) {
      //excluding sunday
      if (date.getDay() !== 0) {
        dates.push(new Date(date));
      }
      date.setDate(date.getDate() + 1);
    }

    return dates;
  }

  // filter all events from current courses

  // function to check if there is an event on a specific date
  function checkIfEventOnDate(date) {
    let dur = 0;
    if (events.length === 0) {
      return dur;
    }

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const eventDate = new Date(event.start);
      const eventEndDate = new Date(event.end);

      if (
        (eventDate.getDate() === date.getDate() &&
          eventDate.getMonth() === date.getMonth() &&
          eventDate.getFullYear() === date.getFullYear()) ||
        (eventEndDate.getDate() === date.getDate() &&
          eventEndDate.getMonth() === date.getMonth() &&
          eventEndDate.getFullYear() === date.getFullYear())
      ) {
        dur += event.durationInMinutes;
      }
    }

    return dur / 60;
  }

  function returnAllCoursesFromDate(date) {
    const courses = [];
    if (events.length === 0) {
      return courses;
    }

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const eventDate = new Date(event.start);
      const eventEndDate = new Date(event.end);

      if (
        (eventDate.getDate() === date.getDate() &&
          eventDate.getMonth() === date.getMonth() &&
          eventDate.getFullYear() === date.getFullYear()) ||
        (eventEndDate.getDate() === date.getDate() &&
          eventEndDate.getMonth() === date.getMonth() &&
          eventEndDate.getFullYear() === date.getFullYear())
      ) {
        courses.push(event.courseNumber);
      }
    }

    return courses;
  }

  function checkIfCourseHasEvent(date) {
    if (
      events.length === 0 ||
      !hovered ||
      !hovered.calendarEntry.length === 0
    ) {
      return false;
    }

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const eventDate = new Date(event.start);
      const eventEndDate = new Date(event.end);

      if (
        (eventDate.getDate() === date.getDate() &&
          eventDate.getMonth() === date.getMonth() &&
          eventDate.getFullYear() === date.getFullYear() &&
          event.courseNumber === hovered.courseNumber) ||
        (eventEndDate.getDate() === date.getDate() &&
          eventEndDate.getMonth() === date.getMonth() &&
          eventEndDate.getFullYear() === date.getFullYear() &&
          event.courseNumber === hovered.courses[0].courseNumber)
      ) {
        return true;
      }
    }

    return false;
  }

  const handleMouseEnter = useCallback((date) => {
    setHoveredDate(date);
    setCourseOnDay(returnAllCoursesFromDate(date));
  }, [returnAllCoursesFromDate]);

  return (
    <div className="flex flex-col">
      <div className="justify-center flex-1 w-full ml-2 font-semibold text-center text-md align-center">
        {hoveredDate
          ? getDateString(hoveredDate)
          : "Hover over a date or course for details"}
      </div>

      <div className="flex p-2 bg-white border-none outline-none text-xxs scrollbar-hide">
        <div className="bg-white outline-none">
          <div className="pt-2 font-bold text-center align-middle outline-none">
            CW
          </div>
          <div className="grid items-center grid-flow-col grid-rows-6 gap-1 p-2 text-xs text-gray-700 outline-none">
            <div className="flex items-center h-4 xl:h-6">Mon</div>
            <div className="flex items-center h-4 xl:h-6">Tue</div>
            <div className="flex items-center h-4 xl:h-6">Wed</div>
            <div className="flex items-center h-4 xl:h-6">Thu</div>
            <div className="flex items-center h-4 xl:h-6">Fri</div>
            <div className="flex items-center h-4 xl:h-6">Sat</div>
          </div>
        </div>
        <div className="flex flex-col flex-1 border-0 outline-none scrollbar-hide">
          <div className="grid justify-between h-4 grid-flow-col gap-1 p-2 mb-2 outline-none scrollbar-hide">
            {/* show every calendar week looping through dates, only show every new week */}
            {dates.map((date) => {
              return date.getDay() === 1 ? (
                <div
                  key={date.toISOString()}
                  className="w-4 h-4 text-center xl:w-6 xl:h-6 text-xxs"
                >
                  {getWeekNumber(date)[1]}
                </div>
              ) : null;
            })}
          </div>
          <div className="grid justify-between grid-flow-col grid-rows-6 gap-1 p-2 overflow-scroll bg-white border-0 outline-none scrollbar-hide">
            {dates.map((date) => (
              <div
                key={date.toISOString()}
                className={`flex items-center text-center align-middle border-1 border  justify-center  xl:w-6 xl:h-6 w-4 h-4 m-auto text-xxs rounded font 
              ${
                date.getDate() === 1
                  ? "border-black bg-white"
                  : "border-transparent "
              }
              ${
                checkIfCourseHasEvent(date)
                  ? "transform scale-125 font-bold"
                  : ""
              }
                  ${
                    checkIfEventsOverlap(date)
                      ? "bg-warning border-warning opacity-1"
                      : checkIfEventOnDate(date) >= 8
                      ? " bg-main border-main border-opacity-1"
                      : checkIfEventOnDate(date) >= 6
                      ? " bg-main bg-opacity-90 border-main border-opacity-90"
                      : checkIfEventOnDate(date) >= 4
                      ? " bg-main bg-opacity-75 border-main border-opacity-75"
                      : checkIfEventOnDate(date) >= 2
                      ? " bg-main bg-opacity-50 border-main border-opacity-50"
                      : checkIfEventOnDate(date) > 0
                      ? " bg-main bg-opacity-30 border-main border-opacity-30 "
                      : " opacity-50 bg-gray-800 bg-opacity-20"
                  } 
                ${date.getDate() === 1 ? "font-semibold text-black" : ""}
                
                
                `}
                onMouseEnter={() => handleMouseEnter(date)}
                onMouseLeave={() => {
                  setHoveredDate(null);
                  setCourseOnDay([]);
                }}
                style={{ fontSize: "0.5rem" }}
              >
                {date.getDate() === 1 ? (
                  "1." + (date.getMonth() + 1) // first letter of month: date.toLocaleString("default", { month: "narrow" })
                ) : checkIfCourseHasEvent(date) ? (
                  <div></div>
                ) : checkIfHoveredDate(date) ? (
                  <div>{checkIfEventOnDate(date).toFixed(0)}h</div>
                ) : (
                  <div></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-center flex-1 w-full h-full px-2 text-xxs">
        <div className="flex items-center px-2">
          <div className={`flex mr-2 rounded-sm bg-main w-2 h-2`} />
          {">"} 8h
        </div>
        <div className="flex items-center px-2">
          <div className="flex w-2 h-2 mr-2 rounded-sm bg-main bg-opacity-90" />
          {">"} 6h
        </div>
        <div className="flex items-center px-2">
          <div className="flex w-2 h-2 mr-2 bg-opacity-75 rounded-sm bg-main" />
          {">"} 4h
        </div>
        <div className="flex items-center px-2">
          <div className="flex w-2 h-2 mr-2 bg-opacity-50 rounded-sm bg-main" />
          {">"} 2h
        </div>
        <div className="flex items-center px-2">
          <div className="flex w-2 h-2 mr-2 rounded-sm bg-opacity-30 bg-main" />
          {">"} 0h
        </div>
        <div className="flex items-center px-2">
          <div className="flex w-2 h-2 mr-2 rounded-sm bg-warning" />
          courses overlap
        </div>
      </div>
    </div>
  );
};
// {checkIfEventOnDate(date).toFixed(1)}h

Heatmap.propTypes = {
  hovered: PropTypes.object,
  setCourseOnDay: PropTypes.func.isRequired,
  hoveredDate: PropTypes.instanceOf(Date),
  setHoveredDate: PropTypes.func.isRequired,
};
