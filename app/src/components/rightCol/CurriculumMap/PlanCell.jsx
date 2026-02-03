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
  isCategoryComplete,
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

  // Cell background based on category completion (column-wide) or semester status (row)
  // Category completion takes precedence for visual feedback
  const getCellBackground = () => {
    if (isCategoryComplete) {
      return "bg-green-100"; // Column-wide green when category requirements met
    }
    // Fall back to semester status colors
    const statusBg = {
      completed: "bg-green-50",
      current: "bg-amber-50",
      future: "bg-white",
    };
    return statusBg[semesterStatus] || "bg-white";
  };
  const cellBackground = getCellBackground();

  const hasConflicts = validations?.conflicts?.length > 0;
  const hasWarnings = validations?.warnings?.length > 0;

  // Visual feedback for drag-over states (uses ring to layer on top of border)
  const getDragOverClasses = () => {
    if (!isOver || !active) return "";

    if (canDrop) {
      // Valid drop target - green highlight
      return "ring-2 ring-green-500 ring-inset bg-green-100";
    } else {
      // Invalid drop target (completed semester) - red highlight
      return "ring-2 ring-red-400 ring-inset bg-red-50";
    }
  };

  // Validation styling - uses ring-inset to compose with drag-over feedback
  const getValidationClasses = () => {
    if (hasConflicts) return "ring-2 ring-red-400 ring-inset";
    if (hasWarnings) return "ring-2 ring-amber-400 ring-inset";
    return "";
  };

  // Base border for cell structure
  const borderClass = "border border-gray-200";
  const validationClass = getValidationClasses();

  // Border radius for bottom-right corner
  const roundedClass = isLastRow && isLastCol ? "rounded-br-lg" : "";

  // Drag-over visual feedback (takes precedence over validation styling)
  const dragOverClass = getDragOverClasses();

  // Combined ring class: drag-over takes precedence, otherwise show validation
  const ringClass = dragOverClass || validationClass;

  // Collapsed view - show just a count badge
  if (isCollapsed) {
    const courseCount = courses.length;
    const totalCredits = courses.reduce((sum, c) => sum + (c.credits || 0), 0);

    return (
      <div
        ref={setNodeRef}
        className={`${cellBackground} ${borderClass} ${roundedClass} ${ringClass} p-1 min-h-[75px] flex flex-col items-center justify-center transition-colors`}
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
      className={`${cellBackground} ${borderClass} ${roundedClass} ${ringClass} p-1.5 min-h-[75px] flex flex-col gap-1 transition-colors`}
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
  isCategoryComplete: PropTypes.bool,
};

export default PlanCell;
