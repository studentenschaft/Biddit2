/**
 * SemesterRow.jsx
 *
 * Row header cell showing semester information (key, status, credits).
 * Sticky positioned so it remains visible when scrolling horizontally.
 * Uses HSG color palette aligned with StudyOverview patterns.
 * Includes an annotation icon to attach free-text notes to each semester.
 */

import { useState } from "react";
import PropTypes from "prop-types";
import { AnnotationIcon as AnnotationIconSolid } from "@heroicons/react/solid";
import { AnnotationIcon as AnnotationIconOutline } from "@heroicons/react/outline";
import SemesterNotePopover from "./SemesterNotePopover";

const SemesterRow = ({ semester, isLast, onSetNote, orientation = "row" }) => {
  const { key, status, totalCredits, plannedCredits, note } = semester;
  const [showNotePopover, setShowNotePopover] = useState(false);

  const hasNote = Boolean(note);

  // Status-based styling using unified green theme
  // Using full opacity for WCAG contrast compliance
  const statusStyles = {
    completed: {
      bg: "bg-green-50",
      textColor: "text-green-700",
      label: "Completed",
    },
    current: {
      bg: "bg-green-50",
      textColor: "text-green-700",
      label: "Current",
    },
    future: {
      bg: "bg-gray-50",
      textColor: "text-gray-600",
      label: "Planned",
    },
  };

  const style = statusStyles[status] || statusStyles.future;

  // Border radius for last row
  const roundedClass = isLast ? "rounded-bl-lg" : "";

  const NoteIcon = hasNote ? AnnotationIconSolid : AnnotationIconOutline;

  // The semester we are in, marked like today's column in the Calendar: the
  // key in a green pill and the header in a light green tint with an outline.
  const isCurrent = status === "current";
  const headerBg = isCurrent
    ? "bg-hsg-50 ring-1 ring-inset ring-hsg-200"
    : style.bg;
  const semesterKey = isCurrent ? (
    <div className="font-bold text-sm">
      <span className="rounded-full bg-hsg-700 px-2 text-white">{key}</span>
      <span className="sr-only"> (current semester)</span>
    </div>
  ) : (
    <div className="font-bold text-sm text-gray-800">{key}</div>
  );

  // Column orientation — used as a column header in flipped grid mode
  if (orientation === "column") {
    return (
      <div
        className={`${headerBg} relative p-2 border-b border-gray-100 text-center min-w-[120px]`}
      >
        {semesterKey}
        <div className="text-[10px] text-gray-500 mt-0.5">
          {totalCredits > 0 ? (
            <>
              <span className={`font-semibold ${style.textColor}`}>
                {totalCredits}
              </span>
              <span className="ml-0.5">ECTS</span>
            </>
          ) : (
            "—"
          )}
        </div>
        {status !== "completed" && plannedCredits > 0 && (
          <div className="text-[9px] text-gray-500 mt-0.5">
            incl. {plannedCredits} planned
          </div>
        )}
        {onSetNote && (
          <div className="mt-1 flex justify-center">
            <button
              onClick={() => setShowNotePopover((prev) => !prev)}
              className={`p-0.5 rounded transition-colors ${
                hasNote
                  ? "text-blue-500 hover:text-blue-700"
                  : "text-gray-400 hover:text-gray-600"
              }`}
              title={hasNote ? note : "Add a note"}
            >
              <NoteIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {showNotePopover && onSetNote && (
          <SemesterNotePopover
            semesterKey={key}
            initialNote={note}
            onSave={onSetNote}
            onClose={() => setShowNotePopover(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`${headerBg} ${roundedClass} relative p-2 sticky left-0 z-10 flex flex-col justify-center min-h-[70px] border-b border-gray-100`}
    >
      {/* Semester key + note icon */}
      <div className="flex items-center gap-1">
        {semesterKey}
        {onSetNote && (
          <button
            onClick={() => setShowNotePopover((prev) => !prev)}
            className={`p-0.5 rounded transition-colors ${
              hasNote
                ? "text-blue-500 hover:text-blue-700"
                : "text-gray-400 hover:text-gray-600"
            }`}
            title={hasNote ? note : "Add a note"}
          >
            <NoteIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Credit summary */}
      <div className="text-[10px] text-gray-700 mt-0.5">
        {totalCredits > 0 ? (
          <>
            <span className={`font-semibold ${style.textColor}`}>{totalCredits}</span>
            <span className="text-gray-500 ml-0.5">ECTS</span>
          </>
        ) : (
          <span className="text-gray-500">—</span>
        )}
      </div>

      {/* Planned credits indicator for non-completed semesters */}
      {status !== "completed" && plannedCredits > 0 && (
        <div className="text-[9px] text-gray-500 mt-0.5">
          incl. {plannedCredits} planned
        </div>
      )}

      {/* Note popover */}
      {showNotePopover && onSetNote && (
        <SemesterNotePopover
          semesterKey={key}
          initialNote={note}
          onSave={onSetNote}
          onClose={() => setShowNotePopover(false)}
        />
      )}
    </div>
  );
};

SemesterRow.propTypes = {
  semester: PropTypes.shape({
    key: PropTypes.string.isRequired,
    status: PropTypes.oneOf(["completed", "current", "future"]).isRequired,
    totalCredits: PropTypes.number,
    completedCredits: PropTypes.number,
    plannedCredits: PropTypes.number,
    courseCount: PropTypes.number,
    note: PropTypes.string,
  }).isRequired,
  isLast: PropTypes.bool,
  onSetNote: PropTypes.func,
  orientation: PropTypes.oneOf(["row", "column"]),
};

export default SemesterRow;
