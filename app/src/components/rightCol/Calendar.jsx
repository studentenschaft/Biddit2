// Dependencies
import React from "react";

import { Tooltip as ReactTooltip } from "react-tooltip";
import FullCalendar from "@fullcalendar/react"; // must go before plugins
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import { ChevronRightIcon, ChevronLeftIcon } from "@heroicons/react/solid";
// import moment from "moment";
// Other
import "./calendar.css";
import { useRecoilValue } from "recoil";
import { calendarEntriesSelector } from "../recoil/calendarEntriesSelector";
import LoadingText from "../common/LoadingText";

//Debug attempt for calendar not showing labels when clicking calendar while app is still loading
import { latestValidTermAtom } from "../recoil/latestValidTermAtom";

// future semesters handling
import { isFutureSemesterSelected } from "../recoil/isFutureSemesterSelected";

// Implementation of calendar widget
export default function Calendar() {
  const finalEvents = useRecoilValue(calendarEntriesSelector);
  const latestValidTerm = useRecoilValue(latestValidTermAtom);
  const [isLoading, setIsLoading] = React.useState(true);
  const [calendarKey, setCalendarKey] = React.useState(0);
  const calendarRef = React.useRef();
  // Add state to track initial date for mounting the calendar
  const [initialDate, setInitialDate] = React.useState(new Date());

  // Get future semester state
  const isFutureSemesterSelectedState = useRecoilValue(
    isFutureSemesterSelected
  );

  console.log("Final Events:", finalEvents);
  console.log("Calender Entries selector:", calendarEntriesSelector);

  // Get first and last event dates for future semester navigation
  const [firstEventDate, setFirstEventDate] = React.useState(null);
  const [lastEventDate, setLastEventDate] = React.useState(null);

  // Determine initial date and event boundaries when events change, ignoring outlier events
  React.useEffect(() => {
    if (finalEvents && finalEvents.length > 0) {
      setIsLoading(false);

      // Sort events by start date
      const sortedEvents = [...finalEvents].sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      );

      // Ensure we have valid events with start dates
      const validEvents = sortedEvents.filter((event) => event && event.start);

      if (validEvents.length === 0) {
        console.warn("No valid events with start dates found");
        return;
      }

      // Ignore outliers: use the 5th and 95th percentile events as boundaries if enough events exist
      let firstIdx = 0;
      let lastIdx = validEvents.length - 1;
      if (validEvents.length > 10) {
        firstIdx = Math.floor(validEvents.length * 0.05);
        lastIdx = Math.ceil(validEvents.length * 0.95) - 1;
      }

      // Ensure indices are within bounds
      firstIdx = Math.max(0, Math.min(firstIdx, validEvents.length - 1));
      lastIdx = Math.max(0, Math.min(lastIdx, validEvents.length - 1));

      const firstDate = validEvents[firstIdx].start;
      const lastDate = validEvents[lastIdx].start;

      setFirstEventDate(new Date(firstDate));
      setLastEventDate(new Date(lastDate));

      // If future semester, set initial date to first event (ignoring outliers)
      if (isFutureSemesterSelectedState && validEvents.length > 0) {
        setInitialDate(new Date(firstDate));
      }

      // Force full re-render with new key when events change
      setCalendarKey((prev) => prev + 1);
    }
  }, [finalEvents, latestValidTerm, isFutureSemesterSelectedState]);

  // Information on hovering
  const hoverEvent = (info) => {
    let title = info.event.title;
    let startTime = info.event.start.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    let endTime = info.event.end.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    let room = info.event._def.extendedProps.room;

    info.el.setAttribute("data-tip", `${title}`);
    info.el.setAttribute("data-tooltip-id", "event-tooltip");
    info.el.setAttribute("data-tooltip-content", `${title}`);
    info.el.setAttribute("data-room", `${room}`);
    info.el.setAttribute("data-start-time", `${startTime}`);
    info.el.setAttribute("data-end-time", `${endTime}`);
  };

  // Text to be displayed when hovering
  function renderEventContent(eventInfo) {
    return (
      <>
        <p className="truncate">{eventInfo.timeText}</p>
        <p className="font-bold truncate">{eventInfo.event.title}</p>
        <p className="truncate text-red">
          {eventInfo.event._def.extendedProps.room}
        </p>
      </>
    );
  }

  const WeekChange = (value) => {
    let calendarApi = calendarRef.current.getApi();

    // Navigate
    value === "next" ? calendarApi.next() : calendarApi.prev();

    // Store the target date for the new calendar instance
    const newDate = calendarApi.getDate();
    setInitialDate(newDate);

    // Force remount with new key
    setCalendarKey((prev) => prev + 1);
  };

  const NavigateToDate = (targetDate) => {
    if (!targetDate) return;

    let calendarApi = calendarRef.current.getApi();
    calendarApi.gotoDate(targetDate);

    // Store the target date for the new calendar instance
    setInitialDate(targetDate);

    // Force remount with new key
    setCalendarKey((prev) => prev + 1);
  };

  const Today = () => {
    let calendarApi = calendarRef.current.getApi();

    // Navigate to today
    calendarApi.today();

    // Store today's date for the new calendar instance
    const todayDate = calendarApi.getDate();
    setInitialDate(todayDate);

    // Force remount with new key
    setCalendarKey((prev) => prev + 1);
  };

  var cal = {
    firstDay: "1",
    dayHeaderFormat: {
      weekday: "short",
      day: "numeric",
      month: "short",
    },
    eventColor: "#006625",
  };

  // handle future semesters
  console.log("isFutureSemesterSelected:", isFutureSemesterSelectedState);

  return (
    <>
      <ReactTooltip
        id="event-tooltip"
        style={{ zIndex: 9999 }}
        render={({ content, activeAnchor }) => (
          <span>
            {content}
            <br />
            Room: {activeAnchor?.getAttribute("data-room") || "N/A"}
            <br />
            {activeAnchor?.getAttribute("data-start-time") || "N/A"} -{" "}
            {activeAnchor?.getAttribute("data-end-time") || "N/A"}
          </span>
        )}
      />

      {/* Show projection data banner for future semesters */}
      {isFutureSemesterSelectedState && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 p-2 mb-2 text-yellow-700">
          <p className="text-sm font-medium">
            Showing projected schedule data for a future semester. All dates are
            based on the previous semester&apos;s schedule and are likely to
            change.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <LoadingText>Loading calendar entries...</LoadingText>
        </div>
      ) : finalEvents.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500 text-lg">
            No courses available for this semester
          </p>
        </div>
      ) : (
        <div className="flex w-full h-full">
          {/* Left navigation */}
          <div className="flex flex-col items-center justify-center h-full ease-in-out focus-within mt-7">
            {/* Move navigation buttons below the notice by adding extra margin if notice is shown */}
            <div
              className={`absolute p-2 text-gray-500 rounded-lg cursor-pointer hover:bg-gray-200 active:bg-gray-300 top-20 ${
                isFutureSemesterSelectedState ? "mt-12" : ""
              }`}
              style={isFutureSemesterSelectedState ? { top: "5.5rem" } : {}}
            >
              {isFutureSemesterSelectedState ? (
                <div className="flex space-x-2">
                  <button
                    className="bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded z-20"
                    onClick={() => NavigateToDate(firstEventDate)}
                  >
                    Start
                  </button>
                  <button
                    className="bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded z-20"
                    onClick={() => NavigateToDate(lastEventDate)}
                  >
                    End
                  </button>
                </div>
              ) : (
                <div onClick={Today}>Today</div>
              )}
            </div>
            <div className="p-2 rounded-lg cursor-pointer hover:bg-gray-200 active:bg-gray-300">
              <ChevronLeftIcon
                aria-hidden="true"
                className="w-10 h-full text-gray-500 align-middle "
                onClick={() => WeekChange("prev")}
              />
            </div>
          </div>

          {/* Calendar */}
          <div className="relative flex-1" key={calendarKey}>
            <FullCalendar
              ref={calendarRef}
              plugins={[timeGridPlugin, dayGridPlugin]}
              initialView="timeGridWeek"
              initialDate={initialDate} // This ensures correct date on mount
              height="100%"
              events={finalEvents}
              firstDay={cal.firstDay}
              slotMinTime="08:00:00"
              slotMaxTime="22:00:00"
              hiddenDays="[0]"
              eventColor="#006625"
              expandRows={true}
              slotEventOverlap={false}
              eventContent={renderEventContent}
              eventMouseEnter={hoverEvent}
              allDaySlot={false}
              headerToolbar={false}
              footerToolbar={false}
              slotLabelFormat={cal.eventTimeFormat}
              slotLabelInterval={cal.slotLabelInterval}
              dayHeaderFormat={cal.dayHeaderFormat}
              rerenderDelay={10}
            />
          </div>
          {/* Right navigation */}
          <div className="flex items-center mt-7">
            <div className="p-2 rounded-lg cursor-pointer hover:bg-gray-200 active:bg-gray-300">
              <ChevronRightIcon
                aria-hidden="true"
                className="w-10 text-gray-500 align-middle "
                onClick={() => WeekChange("next")}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export { Calendar };
