/**
 * CalendarEventSheet.jsx
 *
 * Bottom sheet showing the details of a single calendar event. Opened by
 * tapping an event in the calendar, which is the only detail affordance
 * available on touch devices (the react-tooltip is hover-only). Calendar only
 * ever fills `event` below md, so this sheet is a mobile surface — see the
 * viewport guard in Calendar's clickEvent.
 *
 * Pure presentational component: it knows nothing about FullCalendar so it can
 * be rendered and unit tested on its own.
 *
 * Built on Headless UI's Dialog rather than a hand-rolled div, like every other
 * modal in the app (ReviewButton, AboutButton, CurriculumMapTutorial): it is
 * what supplies the focus trap, the focus restore on close, the inert
 * background and the Escape handler that a bare `role="dialog"` only claims to
 * have.
 */

import PropTypes from "prop-types";
import { Dialog } from "@headlessui/react";
import { XIcon } from "@heroicons/react/solid";

const CalendarEventSheet = ({ event, onClose }) => {
  const conflictList = event?.conflictsWith || [];

  return (
    <Dialog
      open={!!event}
      onClose={onClose}
      /**
       * z-[55]/z-[56], the rung between the app's in-page layers and the side
       * nav's dialogs. The Dialog portals to document.body, so its z-index is
       * compared against the page's own layers in the root stacking context:
       * it has to clear the z-50 band (StudyondBanner, SpecialCourseTopBanner,
       * the mobile info button in Biddit2, the Curriculum Map's popovers) or
       * those paint over the open sheet. It deliberately stays *below* the
       * z-[60] side-nav dialogs (ratings / about — see the note in
       * ReviewButton), which must be able to cover this sheet in turn, and
       * below the z-[9999] app-state blockers (session expired / renew /
       * offline) above them.
       */
      className="relative z-[55]"
      data-testid="calendar-event-sheet"
    >
      {/* Backdrop. Headless UI closes the dialog on a click outside the panel,
          so this is decoration — it needs no click handler of its own. */}
      <div
        className="fixed inset-0 z-[55] bg-black bg-opacity-40"
        aria-hidden="true"
        data-testid="calendar-event-sheet-backdrop"
      />

      <Dialog.Panel
        className="fixed inset-x-0 bottom-0 z-[56] bg-white rounded-t-xl shadow-lg p-4 pb-6 max-h-[70vh] overflow-y-auto"
        data-testid="calendar-event-sheet-panel"
      >
        <div className="flex items-start justify-between gap-3">
          <Dialog.Title
            as="h3"
            className="text-base font-bold text-gray-900 break-words"
          >
            {event?.title}
          </Dialog.Title>
          <button
            className="p-1 -mt-1 -mr-1 rounded-md text-gray-500 hover:bg-gray-100 active:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-hsg-500"
            onClick={onClose}
            aria-label="Close event details"
          >
            <XIcon className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-2 text-sm text-gray-600">
          {event?.startTime || "N/A"} - {event?.endTime || "N/A"}
        </div>
        <div className="text-sm text-gray-600">
          Room: {event?.room || "N/A"}
        </div>

        {conflictList.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 text-amber-700">
            <div className="font-medium">⚠ Conflicts with:</div>
            <ul className="list-disc list-inside text-sm">
              {conflictList.map((course, idx) => (
                <li key={idx}>{course}</li>
              ))}
            </ul>
          </div>
        )}
      </Dialog.Panel>
    </Dialog>
  );
};

CalendarEventSheet.propTypes = {
  event: PropTypes.shape({
    title: PropTypes.string,
    startTime: PropTypes.string,
    endTime: PropTypes.string,
    room: PropTypes.string,
    conflictsWith: PropTypes.arrayOf(PropTypes.string),
  }),
  onClose: PropTypes.func.isRequired,
};

export default CalendarEventSheet;
export { CalendarEventSheet };
