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

// Implementation of calendar widget
export default function Calendar() {
  const finalEvents = useRecoilValue(calendarEntriesSelector);
  const latestValidTerm = useRecoilValue(latestValidTermAtom);
  const [isLoading, setIsLoading] = React.useState(true);
  const [calendarKey, setCalendarKey] = React.useState(0);
  const calendarRef = React.useRef();

  // Force a complete re-render of the calendar when data changes
  React.useEffect(() => {
    if (finalEvents && finalEvents.length > 0) {
      setIsLoading(false);
      // Force full re-render with new key when events change
      setCalendarKey((prev) => prev + 1);
    }
  }, [finalEvents, latestValidTerm]);

  // Add effect to ensure calendar is properly rendered after loading
  React.useEffect(() => {
    if (!isLoading && calendarRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        const api = calendarRef.current.getApi();
        api.render(); // Force calendar to re-render
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isLoading, calendarKey]);

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
    value === "next" ? calendarApi.next() : calendarApi.prev();

    // Force full component re-render with new key
    setCalendarKey((prev) => prev + 1);

    // Small delay for render
    setTimeout(() => {
      calendarApi.render(); // Force calendar to re-render after navigation
    }, 100); // Slightly longer delay (100ms instead of 50ms)
  };

  // UNCOMMENT FOR CUSTOM BUTTON
  const Today = () => {
    let calendarApi = calendarRef.current.getApi();
    calendarApi.today();

    // Force full component re-render with new key
    setCalendarKey((prev) => prev + 1);

    // Small delay for render
    setTimeout(() => {
      calendarApi.render();
    }, 100); // Slightly longer delay
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
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <LoadingText>Loading calendar entries...</LoadingText>
        </div>
      ) : (
        <div className="flex w-full h-full">
          <div className="flex flex-col items-center justify-center h-full ease-in-out focus-within mt-7">
            <div className="absolute p-2 text-gray-500 rounded-lg cursor-pointer hover:bg-gray-200 active:bg-gray-300 top-20">
              <div onClick={Today}>Today</div>
            </div>
            <div className="p-2 rounded-lg cursor-pointer hover:bg-gray-200 active:bg-gray-300">
              <ChevronLeftIcon
                aria-hidden="true"
                className="w-10 h-full text-gray-500 align-middle "
                onClick={() => WeekChange("prev")}
              />
            </div>
          </div>

          {/* calendar */}
          <div className="relative flex-1" key={calendarKey}>
            <FullCalendar
              ref={calendarRef}
              plugins={[timeGridPlugin, dayGridPlugin]}
              initialView="timeGridWeek"
              height="100%"
              events={finalEvents}
              firstDay={cal.firstDay}
              slotMinTime="08:00:00"
              slotMaxTime="22:00:00"
              hiddenDays="[0]"
              eventColor="#006625"
              expandRows={true}
              slotEventOverlap={false}
              // eventClick={clickEvent}
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
