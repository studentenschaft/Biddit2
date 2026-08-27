// Dependencies
import React from "react";
import moment from "moment";
import { Tooltip as ReactTooltip } from "react-tooltip";
import FullCalendar from "@fullcalendar/react"; // must go before plugins
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import {
  ChevronRightIcon,
  ChevronLeftIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from "@heroicons/react/solid";

// Other
import "./calendar.css";
import { useRecoilValue } from "recoil";
import { calendarEntriesSelector } from "../recoil/calendarEntriesSelector";
import LoadingText from "../common/LoadingText";
import CalendarEventSheet from "./CalendarEventSheet";

// The event sheet is the touch-only stand-in for the hover tooltip, so it is
// gated to the same breakpoint the mobile layout uses (Tailwind md = 768px).
import { isMobileViewport } from "../helpers/isMobileViewport";

//Debug attempt for calendar not showing labels when clicking calendar while app is still loading
import {
  currentSemesterSelector,
  selectedSemesterSelector,
} from "../recoil/unifiedCourseDataSelectors";

// Central written exams as calendar blocks (ADR 0010). The hook is what fills
// the atom the selector reads, and it refuses borrowed catalogs on its own.
import { examCalendarEventsSelector } from "../recoil/examScheduleSelectors";
import { useExamSchedule } from "../helpers/useExamSchedule";

// future semesters handling
import { isFutureSemesterSelected } from "../recoil/isFutureSemesterSelected";

// Same clock everywhere: the hover tooltip and the event sheet describe the
// same event, so they must not disagree about whether it is 14:15 or 02:15 PM.
const formatEventTime = (date) =>
  date
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

// Implementation of calendar widget
export default function Calendar() {
  const finalEvents = useRecoilValue(calendarEntriesSelector);
  const currentSemester = useRecoilValue(currentSemesterSelector);
  // Same semester `calendarEntriesSelector` builds its lecture events from, so
  // the two event sets can never describe different terms.
  const selectedSemester = useRecoilValue(selectedSemesterSelector);
  useExamSchedule(selectedSemester);
  const examEvents = useRecoilValue(
    examCalendarEventsSelector(selectedSemester),
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [displaySelectCoursesFirst, setDisplaySelectCoursesFirst] =
    React.useState(false);
  const [calendarKey, setCalendarKey] = React.useState(0);
  const calendarRef = React.useRef();
  // Add state to track initial date for mounting the calendar
  const [initialDate, setInitialDate] = React.useState(new Date());
  // Details of the event tapped/clicked by the user, shown in a bottom sheet
  const [selectedEvent, setSelectedEvent] = React.useState(null);

  // Get future semester state
  const isFutureSemesterSelectedState = useRecoilValue(
    isFutureSemesterSelected,
  );

  // Get first and last event dates for future semester navigation
  const [firstEventDate, setFirstEventDate] = React.useState(null);
  const [lastEventDate, setLastEventDate] = React.useState(null);
  // Where lecture navigation stood when the user jumped to the exam period, so
  // the toggle can put them back where they left off.
  const [lectureReturnDate, setLectureReturnDate] = React.useState(null);

  const shouldShowLoading = isLoading;

  // Keep empty-state message in sync with incoming events
  React.useEffect(() => {
    const hasEvents = Array.isArray(finalEvents) && finalEvents.length > 0;
    setDisplaySelectCoursesFirst(!hasEvents);
    if (!hasEvents) {
      setIsLoading(false);
    }
  }, [finalEvents]);

  // Determine initial date and event boundaries when events change, ignoring outlier events
  React.useEffect(() => {
    // The open sheet describes one event out of the set that just changed —
    // after a semester switch or a course removal that event may no longer
    // exist, so the sheet would sit there showing a dead entry. The navigation
    // handlers below do the same for the same reason.
    setSelectedEvent(null);

    if (finalEvents && finalEvents.length > 0) {
      // Sort events by start date
      const sortedEvents = [...finalEvents].sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
      );

      // Ensure we have valid events with start dates
      const validEvents = sortedEvents.filter((event) => event && event.start);

      if (validEvents.length === 0) {
        console.warn("No valid events with start dates found");
        setIsLoading(false);
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

      setIsLoading(false);
    }
  }, [finalEvents, currentSemester, isFutureSemesterSelectedState]);

  // Exam blocks are appended only to what FullCalendar renders, never to the
  // percentile boot logic above: they sit weeks after the last lecture, so
  // letting them into that sample would drag the opening week off the semester.
  const allEvents = React.useMemo(
    () => [...finalEvents, ...examEvents],
    [finalEvents, examEvents],
  );

  // Monday of the first exam week — the jump target. No exams, no button.
  const examWeekStart = React.useMemo(() => {
    if (!examEvents.length) return null;
    const earliest = Math.min(
      ...examEvents.map((event) => new Date(event.start).getTime()),
    );
    return Number.isFinite(earliest)
      ? moment(earliest).startOf("isoWeek").toDate()
      : null;
  }, [examEvents]);

  const showingExamPeriod = !!examWeekStart && initialDate >= examWeekStart;

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
    let extended = info.event._def.extendedProps;
    let room = extended.room;
    let conflictsWith = extended.conflictsWith || [];

    info.el.setAttribute("data-tip", `${title}`);
    info.el.setAttribute("data-tooltip-id", "event-tooltip");
    info.el.setAttribute("data-tooltip-content", `${title}`);
    info.el.setAttribute("data-room", `${room ?? ""}`);
    info.el.setAttribute("data-start-time", `${startTime}`);
    info.el.setAttribute("data-end-time", `${endTime}`);
    info.el.setAttribute("data-conflicts-with", conflictsWith.join(", "));
    // The tooltip renders from these attributes alone, so the exam fields have
    // to travel as strings too.
    info.el.setAttribute("data-entry-type", `${extended.entryType ?? ""}`);
    info.el.setAttribute("data-duration-min", `${extended.durationMin ?? ""}`);
    info.el.setAttribute("data-byod", `${extended.byod === true}`);
  };

  // Details shown when tapping an event (the only detail affordance on touch
  // devices, where the hover tooltip never triggers).
  //
  // Mobile only, and gated here rather than with `md:hidden` on the sheet: the
  // sheet is a Headless UI Dialog, so a merely invisible one would still be
  // mounted, trap focus and make the page inert. Desktop keeps the tooltip and
  // must not have its course list dimmed by a full-width bottom sheet.
  const clickEvent = (arg) => {
    if (!isMobileViewport()) return;

    setSelectedEvent({
      title: arg.event.title,
      startTime: formatEventTime(arg.event.start),
      endTime: formatEventTime(arg.event.end),
      room: arg.event.extendedProps.room,
      conflictsWith: arg.event.extendedProps.conflictsWith || [],
      entryType: arg.event.extendedProps.entryType,
      durationMin: arg.event.extendedProps.durationMin,
      byod: arg.event.extendedProps.byod === true,
    });
  };

  // Text to be displayed when hovering
  function renderEventContent(eventInfo) {
    const details = eventInfo.event._def.extendedProps;
    return (
      <>
        <p className="truncate">{eventInfo.timeText}</p>
        <p className="font-bold truncate">{eventInfo.event.title}</p>
        {/* Exams carry no room; the badge takes its place so a block is never
            mistaken for a lecture. */}
        {details.entryType === "exam" ? (
          <p className="truncate font-semibold uppercase tracking-wide">Exam</p>
        ) : (
          <p className="truncate text-red">{details.room}</p>
        )}
      </>
    );
  }

  const WeekChange = (value) => {
    setSelectedEvent(null);
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

    setSelectedEvent(null);
    let calendarApi = calendarRef.current.getApi();
    calendarApi.gotoDate(targetDate);

    // Store the target date for the new calendar instance
    setInitialDate(targetDate);

    // Force remount with new key
    setCalendarKey((prev) => prev + 1);
  };

  const Today = () => {
    setSelectedEvent(null);
    let calendarApi = calendarRef.current.getApi();

    // Navigate to today
    calendarApi.today();

    // Store today's date for the new calendar instance
    const todayDate = calendarApi.getDate();
    setInitialDate(todayDate);

    // Force remount with new key
    setCalendarKey((prev) => prev + 1);
  };

  // Shared navigation handlers, used by both the desktop side columns and the
  // compact mobile toolbar
  const goToStart = () => NavigateToDate(firstEventDate);
  const goToEnd = () => NavigateToDate(lastEventDate);
  const goToPrevWeek = () => WeekChange("prev");
  const goToNextWeek = () => WeekChange("next");

  // The exam period lies weeks past the last lecture, so it is only reachable
  // through this jump; pressing it again returns to the week left behind.
  const toggleExamPeriod = () => {
    if (showingExamPeriod) {
      NavigateToDate(lectureReturnDate || firstEventDate);
      return;
    }
    setLectureReturnDate(initialDate);
    NavigateToDate(examWeekStart);
  };

  // Rendered in both navigation clusters (mobile toolbar, desktop side column),
  // which differ only in padding.
  const renderExamJumpButton = (paddingClassName) =>
    examWeekStart ? (
      <button
        className={`bg-hsg-900 hover:bg-hsg-800 active:bg-hsg-700 text-white ${paddingClassName} rounded-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-hsg-500 flex items-center gap-1 font-medium text-xs`}
        onClick={toggleExamPeriod}
        aria-label={
          showingExamPeriod ? "Back to lecture weeks" : "Go to exam period"
        }
      >
        {showingExamPeriod ? "Lectures" : "Exams"}
      </button>
    ) : null;

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
        style={{ zIndex: 9999, maxWidth: "min(350px, 90vw)" }}
        render={({ content, activeAnchor }) => {
          const attr = (name) => activeAnchor?.getAttribute(name);
          const conflictsWith = attr("data-conflicts-with");
          const conflictList = conflictsWith ? conflictsWith.split(", ") : [];
          const isExam = attr("data-entry-type") === "exam";
          const durationMin = attr("data-duration-min");
          const examMeta = [
            "Exam",
            durationMin ? `${durationMin} min` : null,
            attr("data-byod") === "true" ? "digital (BYOD)" : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <div>
              <div className="font-medium">{content}</div>
              {/* Exams have no room; the same line carries the exam facts. */}
              <div className="text-gray-300">
                {isExam ? examMeta : `Room: ${attr("data-room") || "N/A"}`}
              </div>
              <div className="text-gray-300">
                {attr("data-start-time") || "N/A"} -{" "}
                {attr("data-end-time") || "N/A"}
              </div>
              {conflictList.length > 0 && (
                <div
                  className={`mt-1 pt-1 border-t border-gray-600 ${
                    isExam ? "text-red-300" : "text-amber-300"
                  }`}
                >
                  <div className="font-medium">⚠ Conflicts with:</div>
                  <ul className="list-disc list-inside text-sm">
                    {conflictList.map((course, idx) => (
                      <li key={idx} className="truncate">{course}</li>
                    ))}
                  </ul>
                </div>
              )}
              {/* The dates come from our own PDF extraction (ADR 0009). */}
              {isExam && (
                <div className="mt-1 text-xs text-gray-400">
                  Indicative — verify officially.
                </div>
              )}
            </div>
          );
        }}
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

      {displaySelectCoursesFirst ? (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="bg-gray-100 rounded-full p-4 mb-4">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No calendar events found, Please select some courses first.
          </h3>

          <p className="text-gray-400 text-sm max-w-md">
            Hint: Some courses may not have any related calendar entries.
          </p>
        </div>
      ) : shouldShowLoading ? (
        <div className="flex items-center justify-center h-full">
          <LoadingText>Loading calendar entries...</LoadingText>
        </div>
      ) : (
        <div className="flex flex-col w-full h-full">
          {/* Mobile navigation toolbar: replaces the side columns below md so
              the calendar gets the full viewport width */}
          <div className="flex md:hidden items-center justify-between gap-1 pb-2">
            <button
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 active:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
              onClick={goToPrevWeek}
              aria-label="Previous week"
            >
              <ChevronLeftIcon aria-hidden="true" className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1">
              <button
                className="bg-hsg-600 hover:bg-hsg-700 active:bg-hsg-800 text-white px-2 py-1.5 rounded-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-hsg-500 flex items-center gap-1 font-medium text-xs"
                onClick={goToStart}
                aria-label="Go to semester start"
              >
                <ChevronDoubleLeftIcon className="w-3 h-3" aria-hidden="true" />
                Start
              </button>

              {!isFutureSemesterSelectedState && (
                <button
                  className="bg-gray-600 hover:bg-gray-700 active:bg-gray-800 text-white px-2 py-1.5 rounded-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 flex items-center gap-1 font-medium text-xs"
                  onClick={Today}
                  aria-label="Go to today"
                >
                  Today
                </button>
              )}

              <button
                className="bg-hsg-600 hover:bg-hsg-700 active:bg-hsg-800 text-white px-2 py-1.5 rounded-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-hsg-500 flex items-center gap-1 font-medium text-xs"
                onClick={goToEnd}
                aria-label="Go to semester end"
              >
                End
                <ChevronDoubleRightIcon
                  className="w-3 h-3"
                  aria-hidden="true"
                />
              </button>

              {renderExamJumpButton("px-2 py-1.5")}
            </div>

            <button
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 active:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
              onClick={goToNextWeek}
              aria-label="Next week"
            >
              <ChevronRightIcon aria-hidden="true" className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-1 min-h-0 w-full">
            {/* Left navigation */}
            <div className="hidden md:flex flex-col items-center justify-center h-full ease-in-out focus-within mt-7">
              {/* Navigation buttons */}
              <div className="flex flex-col items-center gap-2 mb-4">
                <button
                  className="bg-hsg-600 hover:bg-hsg-700 active:bg-hsg-800 text-white px-3 py-1.5 rounded-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-hsg-500 focus:ring-offset-2 flex items-center gap-1 font-medium text-xs"
                  onClick={goToStart}
                  aria-label="Go to semester start"
                >
                  <ChevronDoubleLeftIcon className="w-3 h-3" />
                  Start
                </button>

                {!isFutureSemesterSelectedState && (
                  <button
                    className="bg-gray-600 hover:bg-gray-700 active:bg-gray-800 text-white px-3 py-1.5 rounded-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 flex items-center gap-1 font-medium text-xs"
                    onClick={Today}
                    aria-label="Go to today"
                  >
                    Today
                  </button>
                )}

                <button
                  className="bg-hsg-600 hover:bg-hsg-700 active:bg-hsg-800 text-white px-3 py-1.5 rounded-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-hsg-500 focus:ring-offset-2 flex items-center gap-1 font-medium text-xs"
                  onClick={goToEnd}
                  aria-label="Go to semester end"
                >
                  End
                  <ChevronDoubleRightIcon className="w-3 h-3" />
                </button>

                {renderExamJumpButton("px-3 py-1.5")}
              </div>

              <button
                className="p-2 rounded-lg cursor-pointer hover:bg-gray-200 active:bg-gray-300"
                onClick={goToPrevWeek}
                aria-label="Previous week"
              >
                <ChevronLeftIcon
                  aria-hidden="true"
                  className="w-10 h-full text-gray-500 align-middle "
                />
              </button>
            </div>

            {/* Calendar */}
            <div className="relative flex-1" key={calendarKey}>
              <FullCalendar
                ref={calendarRef}
                plugins={[timeGridPlugin, dayGridPlugin]}
                initialView="timeGridWeek"
                initialDate={initialDate} // This ensures correct date on mount
                height="100%"
                events={allEvents}
                firstDay={cal.firstDay}
                slotMinTime="08:00:00"
                slotMaxTime="22:00:00"
                hiddenDays={[0]}
                eventColor="#006625"
                expandRows={true}
                slotEventOverlap={false}
                eventContent={renderEventContent}
                eventMouseEnter={hoverEvent}
                eventClick={clickEvent}
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
            <div className="hidden md:flex items-center mt-7">
              <button
                className="p-2 rounded-lg cursor-pointer hover:bg-gray-200 active:bg-gray-300"
                onClick={goToNextWeek}
                aria-label="Next week"
              >
                <ChevronRightIcon
                  aria-hidden="true"
                  className="w-10 text-gray-500 align-middle "
                />
              </button>
            </div>
          </div>
        </div>
      )}

      <CalendarEventSheet
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </>
  );
}
export { Calendar };
