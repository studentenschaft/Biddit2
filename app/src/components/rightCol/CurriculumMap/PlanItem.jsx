/**
 * PlanItem.jsx
 *
 * A single course or placeholder item displayed within a grid cell.
 * Shows course name, credits, and status indicators.
 * Uses HSG color palette for consistent branding.
 *
 * Phase 2: Draggable for planned courses (not completed/enrolled)
 */

import PropTypes from "prop-types";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { XIcon } from "@heroicons/react/solid";
import { useCurriculumPlan } from "../../helpers/useCurriculumPlan";

const PlanItem = ({ item, semesterKey }) => {
  const { removeCourse } = useCurriculumPlan();
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
  } = item;

  // Only planned items (not completed, not enrolled) are draggable
  const isDraggable =
    !isCompleted &&
    !isPlaceholder &&
    status !== "completed" &&
    status !== "enrolled";

  // Items can be removed if they are draggable (planned/wishlist items)
  const isRemovable = isDraggable;

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

  // Style variants based on course status (HSG colors)
  const statusStyles = {
    completed: {
      bg: "bg-hsg-100",
      border: "border-hsg-600",
      text: "text-hsg-900",
    },
    enrolled: {
      bg: "bg-amber-100",
      border: "border-amber-500",
      text: "text-amber-900",
    },
    planned: {
      bg: "bg-blue-100",
      border: "border-blue-400",
      text: "text-blue-900",
    },
    placeholder: {
      bg: "bg-gray-50",
      border: "border-gray-300 border-dashed",
      text: "text-gray-600",
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

  // Format credits for display
  const creditsDisplay =
    credits != null
      ? Number.isInteger(credits)
        ? credits
        : credits.toFixed(1)
      : "?";

  // Truncate long course names
  const displayName = name
    ? name.length > 28
      ? name.substring(0, 26) + "..."
      : name
    : "Unknown Course";

  // Status icon - simplified for cleaner look
  const statusIcon = {
    completed: "✓",
    enrolled: "●",
    planned: "○",
    placeholder: "...",
  };

  // Drag indicator for draggable items
  const dragHandle = isDraggable ? (
    <span className="text-[10px] text-gray-400 mr-1 select-none" title="Drag to move">
      ⠿
    </span>
  ) : null;

  // Handle remove button click
  const handleRemove = (e) => {
    e.stopPropagation(); // Prevent drag from starting
    e.preventDefault();
    const itemId = id || courseId;
    if (itemId && semesterKey) {
      removeCourse(itemId, semesterKey, source || "wishlist");
    }
  };

  // Cursor style based on draggability
  const cursorClass = isDraggable
    ? isDragging
      ? "cursor-grabbing"
      : "cursor-grab"
    : "cursor-default";

  // Opacity during drag
  const opacityClass = isDragging ? "opacity-50" : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isDraggable ? { ...listeners, ...attributes } : {})}
      className={`${statusStyle.bg} ${statusStyle.border} ${statusStyle.text} ${cursorClass} ${opacityClass} border rounded px-2 py-1.5 text-xs transition-all hover:shadow-sm select-none`}
      title={`${name} - ${credits} ECTS${grade ? ` (Grade: ${grade})` : ""}${
        isDraggable ? "\nDrag to move" : ""
      }`}
    >
      {/* Top row: drag handle, name and icons */}
      <div className="flex items-start justify-between gap-1">
        <span className="font-medium leading-tight truncate flex-1 flex items-center">
          {dragHandle}
          {displayName}
        </span>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {isRemovable && (
            <button
              onClick={handleRemove}
              onPointerDown={(e) => e.stopPropagation()}
              className="p-0.5 rounded hover:bg-red-200 text-gray-400 hover:text-red-600 transition-colors"
              title="Remove from plan"
            >
              <XIcon className="w-3 h-3" />
            </button>
          )}
          <span className="text-[10px] opacity-70" title={status}>
            {statusIcon[styleKey]}
          </span>
        </div>
      </div>

      {/* Bottom row: credits and grade */}
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[10px] text-gray-600">{creditsDisplay} ECTS</span>
        {(grade || gradeText) && (
          <span className="text-[10px] font-semibold">{grade || gradeText}</span>
        )}
      </div>

      {/* Source indicator - dev only */}
      {source && import.meta.env.DEV && (
        <div className="text-[8px] text-gray-400 mt-0.5 truncate">[{source}]</div>
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
  }).isRequired,
  semesterKey: PropTypes.string.isRequired,
};

export default PlanItem;
