/**
 * SemesterNotePopover.jsx
 *
 * Inline popover for editing a free-text note on a semester row.
 * Extends rightward from the sticky semester column over the grid.
 * Saves on close (Done button, click-outside, or Escape key).
 */

import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";

const MAX_LENGTH = 200;

const SemesterNotePopover = ({ semesterKey, initialNote, onSave, onClose }) => {
  const [text, setText] = useState(initialNote || "");
  const popoverRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Click-outside-to-close (mirrors PlanCell.jsx pattern)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        handleSave();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  });

  const handleSave = () => {
    onSave(semesterKey, text);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      handleSave();
    }
  };

  return (
    <div
      ref={popoverRef}
      className="absolute left-full top-0 ml-1 z-30 w-56 bg-white rounded-lg shadow-lg border border-gray-200 p-2"
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
        onKeyDown={handleKeyDown}
        maxLength={MAX_LENGTH}
        rows={3}
        className="w-full text-xs border border-gray-200 rounded p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
        placeholder={`Add a note for ${semesterKey}...`}
      />

      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-gray-400">
          {text.length}/{MAX_LENGTH}
        </span>
        <button
          onClick={handleSave}
          className="text-[11px] font-medium text-blue-600 hover:text-blue-800 px-2 py-0.5 rounded hover:bg-blue-50 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};

SemesterNotePopover.propTypes = {
  semesterKey: PropTypes.string.isRequired,
  initialNote: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default SemesterNotePopover;
