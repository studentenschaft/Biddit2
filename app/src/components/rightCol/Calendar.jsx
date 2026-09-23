// Dependencies
import React from "react";
import moment from "moment/moment";
import { Tooltip as ReactTooltip } from "react-tooltip";
import FullCalendar from "@fullcalendar/react"; // must go before plugins
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import {
  BookOpenIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ClipboardCheckIcon,
} from "@heroicons/react/solid";

// Other
import "./calendar.css";
import { useRecoilValue } from "recoil";
import { calendarEntriesSelector } from "../recoil/calendarEntriesSelector";
import LoadingText from "../common/LoadingText";
import CalendarEventSheet from "./CalendarEventSheet";

// One detail view per viewport, split at the breakpoint the mobile layout uses
// (Tailwind md = 768px): below it a tapped event opens the event sheet, from it
// up the tooltip shows on hover and keyboard focus.
import { isMobileViewport } from "../helpers/isMobileViewport";

//Debug attempt for calendar not showing labels when clicking calendar while app is still loading
import {
  currentSemesterSelector,
  selectedSemesterSelector,
} from "../recoil/unifiedCourseDataSelectors";

// Central written exams as calendar blocks.
import { examCalendarEventsSelector } from "../recoil/examScheduleSelectors";
import {
  EXAM_DISCLAIMER_SHORT,
  formatExamClashLead,
} from "../helpers/examScheduleUtils";

// future semesters handling
import { isFutureSemesterSelected } from "../recoil/isFutureSemesterSelected";

// Same clock everywhere, and the 24-hour one: the blocks, the tooltip and the
// event sheet describe the same event, so none may call 15:15 "3:15".
const TIME_FORMAT = { hour: "2-digit", minute: "2-digit", hour12: false };
const formatEventTime = (date) =>
  date ? date.toLocaleTimeString([], TIME_FORMAT) : "";

// What the tooltip and the event sheet show about a block, built once.
const eventDetails = ({ title, start, end, extendedProps }) => ({
  title,
  startTime: formatEventTime(start),
  endTime: formatEventTime(end),
  room: extendedProps.room,
  conflictsWith: extendedProps.conflictsWith || [],
  entryType: extendedProps.entryType,
  examDate: extendedProps.examDate,
  examMeta: extendedProps.examMeta,
});

// Implementation of calendar widget
export default function Calendar() {
  const finalEvents = useRecoilValue(calendarEntriesSelector);
  const currentSemester = useRecoilValue(currentSemesterSelector);
  // Same semester `calendarEntriesSelector` builds its lecture events from, so
  // the two event sets can never describe different terms.
  const selectedSemester = useRecoilValue(selectedSemesterSelector);
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

  // Exam blocks are appended only to what FullCalendar renders, never to the
  // percentile boot logic below: they sit weeks after the last lecture, so
  // letting them into that sample would drag the opening week off the semester.
  const allEvents = React.useMemo(
    () => [...finalEvents, ...examEvents],
    [finalEvents, examEvents],
  );

  // Keep empty-state message in sync with incoming events. Exams count: a
  // plan can list the user's exams before any lecture is scheduled.
  React.useEffect(() => {
    setDisplaySelectCoursesFirst(allEvents.length === 0);
    // Without lectures the boot logic below has nothing to wait for.
    if (finalEvents.length === 0) setIsLoading(false);
  }, [allEvents, finalEvents]);

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

  // A semester switch starts navigation over: the week the exam toggle would
  // return to, and any date navigated to, belong to the old term. A future
  // semester gets its opening date from the effect above.
  React.useEffect(() => {
    setLectureReturnDate(null);
    if (!isFutureSemesterSelectedState) setInitialDate(new Date());
  }, [selectedSemester, isFutureSemesterSelectedState]);

  // The exam weeks, Monday of the first to the end of the last: the jump lands
  // on the first, and while the calendar is inside them the button leads back
  // to the lectures. No exams, no button.
  const examWeeks = React.useMemo(() => {
    if (!examEvents.length) return null;
    const starts = examEvents.map((event) => new Date(event.start).getTime());
    return {
      start: moment(Math.min(...starts)).startOf("isoWeek").toDate(),
      end: moment(Math.max(...starts)).endOf("isoWeek").toDate(),
    };
  }, [examEvents]);

  const showingExamPeriod =
    !!examWeeks &&
    initialDate >= examWeeks.start &&
    initialDate <= examWeeks.end;

  // The tooltip renders from this attribute alone. It is set as soon as a
  // block is drawn, not on mouse enter, so the tooltip also opens when the
  // block gets keyboard focus (react-tooltip 5.28 opens on focus as well as
  // mouseover, and FullCalendar makes clickable blocks tabbable).
  const describeEventForTooltip = ({ el, event }) => {
    el.setAttribute("data-tooltip-id", "event-tooltip");
    el.setAttribute("data-event", JSON.stringify(eventDetails(event)));
  };

  // Details shown when an event is tapped: the mobile detail view, and the only
  // one below md (the tooltip stands down there, see its render).
  //
  // Mobile only, and gated here rather than with `md:hidden` on the sheet: the
  // sheet is a Headless UI Dialog, so a merely invisible one would still be
  // mounted, trap focus and make the page inert. Desktop keeps the tooltip and
  // must not have its course list dimmed by a full-width bottom sheet.
  const clickEvent = (arg) => {
    if (!isMobileViewport()) return;

    setSelectedEvent(eventDetails(arg.event));
  };

  // Text inside a block. An exam leads with its start time, the line a
  // 60-minute block still has room for, cut on a narrow block the way a
  // lecture's time is (the outline already says "exam"). Where it fits, a
  // clash says so in words too; the dashed red border says it at any width.
  // The block's look comes with the event (examCalendarEventsSelector).
  function renderEventContent(eventInfo) {
    const details = eventInfo.event.extendedProps;
    if (details.entryType === "exam") {
      // Clipped here, not on the event: a clash's three lines outgrow a
      // 60-minute block, and clipping the event would also cut off its focus
      // ring (calendar.css).
      return (
        <div className="h-full overflow-hidden">
          <p className="truncate font-semibold uppercase">
            {formatEventTime(eventInfo.event.start)} · Exam
          </p>
          {details.conflictsWith.length > 0 && (
            <p className="truncate font-bold uppercase">Clash</p>
          )}
          <p className="font-bold truncate">{eventInfo.event.title}</p>
        </div>
      );
    }
    return (
      <>
        <p className="truncate">{eventInfo.timeText}</p>
        <p className="font-bold truncate">{eventInfo.event.title}</p>
        <p className="truncate text-red">{details.room}</p>
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
    NavigateToDate(examWeeks.start);
  };

  // Rendered in both navigation clusters. A 320px phone's toolbar has no room
  // for the word, so there the button is an icon named by its label; on
  // desktop the visible word is its whole name (WCAG 2.5.3).
  const renderExamJumpButton = ({ iconOnly }) => {
    if (!examWeeks) return null;
    const label = showingExamPeriod ? "Lectures" : "Exams";
    const Icon = showingExamPeriod ? BookOpenIcon : ClipboardCheckIcon;
    return (
      <button
        className={`bg-hsg-900 hover:bg-hsg-800 active:bg-hsg-700 text-white ${
          iconOnly ? "p-1.5" : "px-3 py-1.5"
        } rounded-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-hsg-500 flex items-center gap-1 font-medium text-xs`}
        onClick={toggleExamPeriod}
        aria-label={iconOnly ? label : undefined}
      >
        {iconOnly ? <Icon className="w-4 h-4" aria-hidden="true" /> : label}
      </button>
    );
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
        style={{ zIndex: 9999, maxWidth: "min(350px, 90vw)" }}
        // Content that appears on focus must be dismissable without moving
        // focus (WCAG 1.4.13).
        globalCloseEvents={{ escape: true }}
        render={({ activeAnchor }) => {
          // A tap on a phone also fires mouseover and focus on the block, and
          // the sheet hands focus back to it on closing, so below md the
          // tooltip would open on top of the sheet. Asked as it is about to
          // show, like the sheet's own check at click time.
          if (isMobileViewport() || !activeAnchor) return null;
          const event = JSON.parse(activeAnchor.getAttribute("data-event"));
          const isExam = event.entryType === "exam";
          const timeRange = `${event.startTime || "N/A"} - ${
            event.endTime || "N/A"
          }`;
          return (
            <div>
              <div className="font-medium">{event.title}</div>
              {/* Exams have no room; the same line carries the exam facts. */}
              <div className="text-gray-300">
                {isExam ? event.examMeta : `Room: ${event.room || "N/A"}`}
              </div>
              {/* For an exam the date is the key fact, so it leads the time. */}
              <div className="text-gray-300">
                {isExam ? `${event.examDate}, ${timeRange}` : timeRange}
              </div>
              {event.conflictsWith.length > 0 && (
                <div
                  className={`mt-1 pt-1 border-t border-gray-600 ${
                    isExam ? "text-red-300" : "text-amber-300"
                  }`}
                >
                  <div className="font-medium">
                    ⚠ {isExam ? formatExamClashLead(true) : "Conflicts with:"}
                  </div>
                  <ul className="list-disc list-inside text-sm">
                    {event.conflictsWith.map((course, idx) => (
                      <li key={idx} className="break-words">
                        {course}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* The dates come from our own PDF extraction (ADR 0012). */}
              {isExam && (
                <div className="mt-1 text-xs text-gray-400">
                  {EXAM_DISCLAIMER_SHORT}
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

              {renderExamJumpButton({ iconOnly: true })}
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

                {renderExamJumpButton({ iconOnly: false })}
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
                eventTimeFormat={TIME_FORMAT}
                eventContent={renderEventContent}
                eventDidMount={describeEventForTooltip}
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
