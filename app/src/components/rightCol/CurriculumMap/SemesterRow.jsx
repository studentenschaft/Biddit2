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

const SemesterRow = ({ semester, isLast, onSetNote }) => {
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

  return (
    <div
      className={`${style.bg} ${roundedClass} relative p-2 sticky left-0 z-10 flex flex-col justify-center min-h-[70px] border-b border-gray-100`}
    >
      {/* Semester key + note icon */}
      <div className="flex items-center gap-1">
        <div className="font-bold text-sm text-gray-800">{key}</div>
        {onSetNote && (
          <button
            onClick={() => setShowNotePopover((prev) => !prev)}
            className={`p-0.5 rounded transition-colors ${
              hasNote
                ? "text-blue-500 hover:text-blue-700"
                : "text-gray-300 hover:text-gray-500"
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
          +{plannedCredits} planned
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
};

export default SemesterRow;
