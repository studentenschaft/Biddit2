/**
 * PlanItem.jsx
 *
 * A single course or placeholder item displayed within a grid cell.
 * Shows course name, credits, and status indicators.
 * Uses HSG color palette for consistent branding.
 *
 * Phase 2: Draggable for planned courses (not completed/enrolled)
 * Phase 4: Note, color picker, and label editing
 */

import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { XIcon } from "@heroicons/react/solid";
import { AnnotationIcon } from "@heroicons/react/outline";
import { useCurriculumPlan } from "../../helpers/useCurriculumPlan";

// Color options for border (not yellow/red/green/gray/white)
const COLOR_OPTIONS = [
  { value: "", label: "None", class: "" },
  { value: "#3B82F6", label: "Blue", class: "border-blue-500" },
  { value: "#8B5CF6", label: "Purple", class: "border-purple-500" },
  { value: "#EC4899", label: "Pink", class: "border-pink-500" },
  { value: "#14B8A6", label: "Teal", class: "border-teal-500" },
];

const PlanItem = ({ item, semesterKey, onCourseClick }) => {
  const { removeCourse, removePlaceholder, updatePlacementAttributes } =
    useCurriculumPlan();
  const {
    id,
    courseId,
    name,
    credits,
    status,
    isCompleted,
    isPlaceholder,
    grade,
    gradeText,
    source,
    categoryPath,
    note,
    colorCode,
    label,
  } = item;

  // UI state for editing
  const [showNotePopover, setShowNotePopover] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLabelEdit, setShowLabelEdit] = useState(false);
  const [showCreditsEdit, setShowCreditsEdit] = useState(false);
  const [noteValue, setNoteValue] = useState(note || "");
  const [labelValue, setLabelValue] = useState(label || name || "");
  const [creditsValue, setCreditsValue] = useState(credits || 3);

  const noteRef = useRef(null);
  const colorRef = useRef(null);
  const labelRef = useRef(null);
  const creditsRef = useRef(null);

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (noteRef.current && !noteRef.current.contains(e.target)) {
        setShowNotePopover(false);
      }
      if (colorRef.current && !colorRef.current.contains(e.target)) {
        setShowColorPicker(false);
      }
      if (labelRef.current && !labelRef.current.contains(e.target)) {
        setShowLabelEdit(false);
      }
      if (creditsRef.current && !creditsRef.current.contains(e.target)) {
        setShowCreditsEdit(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Planned items and placeholders are draggable (not completed, not enrolled)
  const isDraggable =
    !isCompleted && status !== "completed" && status !== "enrolled";

  // Items can be removed if they are draggable OR if they are placeholders
  const isRemovable = isDraggable || isPlaceholder;

  // Items can have notes/colors if draggable OR placeholder
  const isEditable = isDraggable || isPlaceholder;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: id || courseId || `item-${semesterKey}-${name}`,
      data: {
        type: "grid-course",
        item,
        semesterKey,
        categoryPath,
        source: source || "plan",
      },
      disabled: !isDraggable,
    });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  // Style variants based on course status (unified green theme)
  const statusStyles = {
    completed: {
      bg: "bg-green-600",
      text: "text-white",
      shadow: "shadow-sm hover:shadow-md",
    },
    enrolled: {
      bg: "bg-green-100",
      text: "text-green-800",
      shadow: "shadow-sm hover:shadow-md",
    },
    planned: {
      bg: "bg-gray-100",
      text: "text-gray-800",
      shadow: "shadow-sm hover:shadow-md",
    },
    placeholder: {
      bg: "bg-gray-50",
      border: "border border-dashed border-gray-300",
      text: "text-gray-500",
      shadow: "",
    },
  };

  // Determine which style to use
  let styleKey = "planned";
  if (isPlaceholder) {
    styleKey = "placeholder";
  } else if (isCompleted || status === "completed") {
    styleKey = "completed";
  } else if (status === "enrolled") {
    styleKey = "enrolled";
  }

  const statusStyle = statusStyles[styleKey];

  // Get border color class from colorCode
  const getBorderClass = () => {
    if (!colorCode) return "";
    const colorOption = COLOR_OPTIONS.find((c) => c.value === colorCode);
    return colorOption ? colorOption.class : "";
  };

  const customBorderClass = getBorderClass();

  // Override border for colored items
  const borderStyle = customBorderClass
    ? `border-2 ${customBorderClass}`
    : statusStyle.border || "";

  // Format credits for display
  const creditsDisplay =
    credits != null
      ? Number.isInteger(credits)
        ? credits
        : credits.toFixed(1)
      : "?";

  // Full name for tooltip (never truncated)
  const fullName = isPlaceholder
    ? label || name || "TBD"
    : name || "Unknown Course";

  // Truncate long course names for display
  const displayName =
    fullName.length > 28 ? fullName.substring(0, 26) + "..." : fullName;

  // Drag indicator for draggable items (only show on hover via group)
  const dragHandle = isDraggable ? (
    <span
      className="text-[10px] text-gray-400 mr-1 select-none opacity-0 group-hover:opacity-100 transition-opacity"
      title="Drag to move"
    >
      ⠿
    </span>
  ) : null;

  // Handle remove button click with error handling
  const handleRemove = (e) => {
    e.stopPropagation();
    e.preventDefault();

    const itemId = id || courseId;

    if (!itemId) {
      if (import.meta.env.DEV) {
        console.warn("[PlanItem] Cannot remove: missing item ID");
      }
      return;
    }

    if (!semesterKey) {
      if (import.meta.env.DEV) {
        console.warn("[PlanItem] Cannot remove: missing semester key");
      }
      return;
    }

    try {
      if (isPlaceholder) {
        removePlaceholder(itemId);
      } else {
        removeCourse(itemId);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[PlanItem] Failed to remove item:", error);
      }
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (!isPlaceholder && onCourseClick) {
      onCourseClick(item);
    }
  };

  // Note handlers
  const handleNoteClick = (e) => {
    e.stopPropagation();
    setNoteValue(note || "");
    setShowNotePopover(true);
    setShowColorPicker(false);
    setShowLabelEdit(false);
    setShowCreditsEdit(false);
  };

  const handleNoteSave = async () => {
    const trimmed = noteValue.trim().slice(0, 200);
    await updatePlacementAttributes(item, semesterKey, {
      note: trimmed || null,
    });
    setShowNotePopover(false);
  };

  // Color handlers
  const handleColorClick = (e) => {
    e.stopPropagation();
    setShowColorPicker(true);
    setShowNotePopover(false);
    setShowLabelEdit(false);
    setShowCreditsEdit(false);
  };

  const handleColorSelect = async (color) => {
    await updatePlacementAttributes(item, semesterKey, {
      colorCode: color || null,
    });
    setShowColorPicker(false);
  };

  // Label handlers (placeholders only)
  const handleLabelClick = (e) => {
    e.stopPropagation();
    setLabelValue(label || name || "TBD");
    setShowLabelEdit(true);
    setShowNotePopover(false);
    setShowColorPicker(false);
    setShowCreditsEdit(false);
  };

  const handleLabelSave = async () => {
    const trimmed = labelValue.trim() || "TBD";
    await updatePlacementAttributes(item, semesterKey, { label: trimmed });
    setShowLabelEdit(false);
  };

  // Credits handlers (placeholders only)
  const handleCreditsClick = (e) => {
    e.stopPropagation();
    setCreditsValue(credits || 3);
    setShowCreditsEdit(true);
    setShowNotePopover(false);
    setShowColorPicker(false);
    setShowLabelEdit(false);
  };

  const handleCreditsSave = async () => {
    const value = Math.max(1, Math.min(30, creditsValue));
    await updatePlacementAttributes(item, semesterKey, { credits: value });
    setShowCreditsEdit(false);
  };

  // Cursor style: draggable items get grab cursor, placeholders get default, others get pointer
  const cursorClass = isDraggable
    ? isDragging
      ? "cursor-grabbing"
      : "cursor-grab"
    : isPlaceholder
      ? "cursor-default"
      : "cursor-pointer";

  // Opacity during drag
  const opacityClass = isDragging ? "opacity-50" : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isDraggable ? { ...listeners, ...attributes } : {})}
      onClick={handleClick}
      className={`group relative ${statusStyle.bg} ${borderStyle} ${statusStyle.text} ${statusStyle.shadow} ${cursorClass} ${opacityClass} rounded-md px-2 py-1 text-xs transition-all select-none`}
      title={`${fullName}${courseId && courseId !== name ? ` (${courseId})` : ""} - ${credits} ECTS${grade ? ` (Grade: ${grade})` : ""}${note ? `\nNote: ${note}` : ""}${
        isDraggable ? "\nDrag to move" : ""
      }`}
    >
      {/* Course name with drag handle - full width */}
      <div className="flex items-center">
        <span className="font-medium leading-tight truncate flex-1 flex items-center">
          {dragHandle}
          {isPlaceholder && isEditable ? (
            <button
              onClick={handleLabelClick}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-left truncate hover:underline w-full"
            >
              {displayName}
            </button>
          ) : (
            displayName
          )}
        </span>
      </div>

      {/* Credits and grade on same line */}
      <div className="flex items-center justify-between mt-0.5 text-[10px]">
        {isPlaceholder && isEditable ? (
          <button
            onClick={handleCreditsClick}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-gray-500 hover:underline hover:text-gray-700"
            title="Click to edit credits"
          >
            {creditsDisplay} ECTS
          </button>
        ) : (
          <span
            className={
              styleKey === "completed" ? "text-green-100" : "text-gray-500"
            }
          >
            {creditsDisplay} ECTS
          </span>
        )}
        {(grade || gradeText) && (
          <span className="font-semibold">{grade || gradeText}</span>
        )}
      </div>

      {/* Action buttons - bottom right, shown on hover */}
      <div className="absolute bottom-0.5 right-1 flex items-center gap-0.5">
        {/* Note indicator - always visible if has note, otherwise only on hover */}
        {isEditable && (
          <button
            onClick={handleNoteClick}
            onPointerDown={(e) => e.stopPropagation()}
            className={`p-0.5 rounded transition-colors ${
              note
                ? "text-blue-500 hover:text-blue-600"
                : "text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100"
            }`}
            title={note ? `Note: ${note}` : "Add note"}
          >
            <AnnotationIcon className="w-3 h-3" />
          </button>
        )}

        {/* Non-editable note indicator */}
        {note && !isEditable && (
          <span className="text-blue-500" title={`Note: ${note}`}>
            <AnnotationIcon className="w-3 h-3" />
          </span>
        )}

        {/* Color picker button - 4-section color wheel, only on hover */}
        {isEditable && (
          <button
            onClick={handleColorClick}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100"
            title="Change color"
          >
            <div
              className="w-3.5 h-3.5 rounded-full border border-gray-400 overflow-hidden"
              style={{
                background: `conic-gradient(
                  #3B82F6 0deg 90deg,
                  #8B5CF6 90deg 180deg,
                  #EC4899 180deg 270deg,
                  #14B8A6 270deg 360deg
                )`,
              }}
            />
          </button>
        )}

        {/* Remove button - only on hover */}
        {isRemovable && (
          <button
            onClick={handleRemove}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-0.5 rounded hover:bg-red-200 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
            title="Remove from plan"
          >
            <XIcon className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Note popover */}
      {showNotePopover && (
        <div
          ref={noteRef}
          className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-2 min-w-[180px]"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <textarea
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            placeholder="Add a note..."
            className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-800 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={3}
            maxLength={200}
            autoFocus
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-[10px] text-gray-400">
              {noteValue.length}/200
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setShowNotePopover(false)}
                className="px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleNoteSave}
                className="px-2 py-0.5 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Color picker popover */}
      {showColorPicker && (
        <div
          ref={colorRef}
          className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-2"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex gap-1.5">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color.value || "none"}
                onClick={() => handleColorSelect(color.value)}
                className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                  colorCode === color.value
                    ? "ring-2 ring-offset-1 ring-gray-400"
                    : ""
                } ${
                  color.value
                    ? ""
                    : "bg-white border-gray-300 relative after:content-[''] after:absolute after:inset-0 after:bg-gray-400 after:w-px after:h-full after:rotate-45 after:left-1/2"
                }`}
                style={color.value ? { backgroundColor: color.value } : {}}
                title={color.label}
              />
            ))}
          </div>
        </div>
      )}

      {/* Label edit popover (placeholders only) */}
      {showLabelEdit && isPlaceholder && (
        <div
          ref={labelRef}
          className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-2 min-w-[150px]"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            placeholder="Label"
            className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            maxLength={50}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLabelSave();
              if (e.key === "Escape") setShowLabelEdit(false);
            }}
          />
          <div className="flex justify-end gap-1 mt-1">
            <button
              onClick={() => setShowLabelEdit(false)}
              className="px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleLabelSave}
              className="px-2 py-0.5 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Credits edit popover (placeholders only) */}
      {showCreditsEdit && isPlaceholder && (
        <div
          ref={creditsRef}
          className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-2 min-w-[120px]"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <label className="block text-[10px] text-gray-600 mb-1">
            ECTS Credits
          </label>
          <input
            type="number"
            min="1"
            max="30"
            value={creditsValue}
            onChange={(e) => setCreditsValue(Number(e.target.value))}
            className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreditsSave();
              if (e.key === "Escape") setShowCreditsEdit(false);
            }}
          />
          <div className="flex justify-end gap-1 mt-1">
            <button
              onClick={() => setShowCreditsEdit(false)}
              className="px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleCreditsSave}
              className="px-2 py-0.5 text-[10px] bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

PlanItem.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string,
    courseId: PropTypes.string,
    name: PropTypes.string,
    credits: PropTypes.number,
    status: PropTypes.string,
    isCompleted: PropTypes.bool,
    isPlanned: PropTypes.bool,
    isPlaceholder: PropTypes.bool,
    grade: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    gradeText: PropTypes.string,
    source: PropTypes.string,
    categoryPath: PropTypes.string,
    note: PropTypes.string,
    colorCode: PropTypes.string,
    label: PropTypes.string,
  }).isRequired,
  semesterKey: PropTypes.string.isRequired,
  onCourseClick: PropTypes.func,
};

export default PlanItem;
