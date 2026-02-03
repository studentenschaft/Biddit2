/**
 * PlanCell.jsx
 *
 * A single cell in the curriculum grid representing the intersection
 * of a semester (row) and category (column). Contains course items.
 * Uses HSG color palette for background colors based on semester status.
 *
 * Phase 2: Drop target for drag-and-drop. Completed semesters are invalid targets.
 */

import PropTypes from "prop-types";
import { useDroppable } from "@dnd-kit/core";
import PlanItem from "./PlanItem";

const PlanCell = ({
  semesterKey,
  categoryPath,
  courses,
  semesterStatus,
  validations,
  isLastRow,
  isLastCol,
  isCollapsed,
}) => {
  // Completed semesters cannot be drop targets
  const canDrop = semesterStatus !== "completed";

  const { setNodeRef, isOver, active } = useDroppable({
    id: `${semesterKey}-${categoryPath}`,
    data: {
      semesterKey,
      categoryPath,
      semesterStatus,
      canDrop,
    },
    disabled: !canDrop,
  });

  // Cell background based on semester status (HSG colors)
  const statusBg = {
    completed: "bg-hsg-50/50",
    current: "bg-amber-50/50",
    future: "bg-white",
  };

  const hasConflicts = validations?.conflicts?.length > 0;
  const hasWarnings = validations?.warnings?.length > 0;

  // Visual feedback for drag-over states
  const getDragOverClasses = () => {
    if (!isOver || !active) return "";

    if (canDrop) {
      // Valid drop target - green highlight
      return "ring-2 ring-hsg-500 bg-hsg-50/50";
    } else {
      // Invalid drop target (completed semester) - red highlight
      return "ring-2 ring-red-400 bg-red-50/30";
    }
  };

  // Border styling for validation issues
  const borderClass = hasConflicts
    ? "border-red-400 border-2"
    : hasWarnings
    ? "border-amber-400 border-2"
    : "border-stone-200 border";

  // Border radius for bottom-right corner
  const roundedClass = isLastRow && isLastCol ? "rounded-br-lg" : "";

  // Drag-over visual feedback
  const dragOverClass = getDragOverClasses();

  // Collapsed view - show just a count badge
  if (isCollapsed) {
    const courseCount = courses.length;
    const totalCredits = courses.reduce((sum, c) => sum + (c.credits || 0), 0);

    return (
      <div
        ref={setNodeRef}
        className={`${statusBg[semesterStatus] || "bg-white"} ${borderClass} ${roundedClass} ${dragOverClass} p-1 min-h-[75px] flex flex-col items-center justify-center transition-colors`}
        data-semester={semesterKey}
        data-category={categoryPath}
        title={`${courseCount} course${courseCount !== 1 ? "s" : ""}, ${totalCredits} ECTS`}
      >
        {courseCount > 0 ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs font-bold text-gray-700">{courseCount}</span>
            <span className="text-[8px] text-gray-500">{totalCredits}</span>
          </div>
        ) : semesterStatus === "future" ? (
          <span className="text-gray-300 text-sm">+</span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`${statusBg[semesterStatus] || "bg-white"} ${borderClass} ${roundedClass} ${dragOverClass} p-1.5 min-h-[75px] flex flex-col gap-1 transition-colors`}
      data-semester={semesterKey}
      data-category={categoryPath}
    >
      {/* Course items - now pass semesterKey */}
      {courses.map((course, index) => (
        <PlanItem
          key={course.id || `${semesterKey}-${categoryPath}-${index}`}
          item={course}
          semesterKey={semesterKey}
        />
      ))}

      {/* Empty state - subtle indicator for future semesters */}
      {courses.length === 0 && semesterStatus === "future" && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-gray-300 text-lg">+</span>
        </div>
      )}

      {/* Validation badges */}
      {(hasConflicts || hasWarnings) && (
        <div className="flex gap-1 mt-auto">
          {hasConflicts && (
            <span
              className="text-[9px] bg-red-100 text-red-700 px-1 rounded font-medium"
              title={validations.conflicts.map((c) => c.details).join("; ")}
            >
              Conflict
            </span>
          )}
          {hasWarnings && (
            <span
              className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded font-medium"
              title={validations.warnings.map((w) => w.warning).join("; ")}
            >
              Warning
            </span>
          )}
        </div>
      )}
    </div>
  );
};

PlanCell.propTypes = {
  semesterKey: PropTypes.string.isRequired,
  categoryPath: PropTypes.string.isRequired,
  courses: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      credits: PropTypes.number,
      status: PropTypes.string,
    })
  ).isRequired,
  semesterStatus: PropTypes.oneOf(["completed", "current", "future"]).isRequired,
  validations: PropTypes.shape({
    conflicts: PropTypes.array,
    warnings: PropTypes.array,
  }),
  isLastRow: PropTypes.bool,
  isLastCol: PropTypes.bool,
  isCollapsed: PropTypes.bool,
};

export default PlanCell;
