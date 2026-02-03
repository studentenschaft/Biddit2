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

  // Style variants based on course status (unified green theme)
  const statusStyles = {
    completed: {
      bg: "bg-green-100",
      border: "border-green-600",
      text: "text-green-900",
    },
    enrolled: {
      bg: "bg-green-50",
      border: "border-green-400",
      text: "text-green-800",
    },
    planned: {
      bg: "bg-gray-100",
      border: "border-gray-300",
      text: "text-gray-800",
    },
    placeholder: {
      bg: "bg-gray-50",
      border: "border-gray-300 border-dashed",
      text: "text-gray-500",
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

  // Drag indicator for draggable items (only show on hover via group)
  const dragHandle = isDraggable ? (
    <span className="text-[10px] text-gray-400 mr-1 select-none opacity-0 group-hover:opacity-100 transition-opacity" title="Drag to move">
      ⠿
    </span>
  ) : null;

  // Handle remove button click with error handling
  const handleRemove = (e) => {
    e.stopPropagation();
    e.preventDefault();

    const itemId = id || courseId;

    if (!itemId) {
      console.warn("[PlanItem] Cannot remove: missing item ID");
      return;
    }

    if (!semesterKey) {
      console.warn("[PlanItem] Cannot remove: missing semester key");
      return;
    }

    try {
      removeCourse(itemId, semesterKey, source || "wishlist");
    } catch (error) {
      console.error("[PlanItem] Failed to remove course:", error);
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
      className={`group ${statusStyle.bg} ${statusStyle.border} ${statusStyle.text} ${cursorClass} ${opacityClass} border rounded px-2 py-1 text-xs transition-all hover:shadow-sm select-none`}
      title={`${name} - ${credits} ECTS${grade ? ` (Grade: ${grade})` : ""}${
        isDraggable ? "\nDrag to move" : ""
      }`}
    >
      {/* Course name with drag handle */}
      <div className="flex items-center justify-between gap-1">
        <span className="font-medium leading-tight truncate flex-1 flex items-center">
          {dragHandle}
          {displayName}
        </span>
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

      {/* Credits and grade on same line */}
      <div className="flex items-center justify-between mt-0.5 text-[10px]">
        <span className="text-gray-500">{creditsDisplay} ECTS</span>
        {(grade || gradeText) && (
          <span className="font-semibold">{grade || gradeText}</span>
        )}
      </div>
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
