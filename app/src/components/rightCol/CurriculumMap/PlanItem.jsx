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

const PlanItem = ({ item, semesterKey, onCourseClick }) => {
  const { removeCourse, removePlaceholder } = useCurriculumPlan();
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

  // Planned items and placeholders are draggable (not completed, not enrolled)
  const isDraggable =
    !isCompleted &&
    status !== "completed" &&
    status !== "enrolled";

  // Items can be removed if they are draggable OR if they are placeholders
  const isRemovable = isDraggable || isPlaceholder;

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
        removePlaceholder(itemId, semesterKey);
      } else {
        removeCourse(itemId, semesterKey, source || "wishlist");
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
      className={`group ${statusStyle.bg} ${statusStyle.border || ""} ${statusStyle.text} ${statusStyle.shadow} ${cursorClass} ${opacityClass} rounded-md px-2 py-1 text-xs transition-all select-none`}
      title={`${name}${courseId && courseId !== name ? ` (${courseId})` : ""} - ${credits} ECTS${grade ? ` (Grade: ${grade})` : ""}${
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
        <span className={styleKey === "completed" ? "text-green-100" : "text-gray-500"}>{creditsDisplay} ECTS</span>
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
  onCourseClick: PropTypes.func,
};

export default PlanItem;
