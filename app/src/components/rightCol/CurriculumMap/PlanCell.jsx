/**
 * PlanCell.jsx
 *
 * A single cell in the curriculum grid representing the intersection
 * of a semester (row) and category (column). Contains course items.
 * Uses HSG color palette for background colors based on semester status.
 *
 * Phase 2: Drop target for drag-and-drop. Completed semesters are invalid targets.
 * Phase 3: Click-to-add placeholder functionality for future semesters.
 */

import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { useDroppable } from "@dnd-kit/core";
import PlanItem from "./PlanItem";
import { useCurriculumPlan } from "../../helpers/useCurriculumPlan";
import { doesClassificationMatchCategory } from "../../recoil/curriculumMapSelector";

const PlanCell = ({
  semesterKey,
  categoryPath,
  courses,
  semesterStatus,
  validations,
  isLastCol,
  isCollapsed,
  isCategoryComplete,
  categoryName,
  validClassifications,
}) => {
  const { addPlaceholder } = useCurriculumPlan();

  // Placeholder form state
  const [showPlaceholderForm, setShowPlaceholderForm] = useState(false);
  const [placeholderCredits, setPlaceholderCredits] = useState(3);
  const [placeholderLabel, setPlaceholderLabel] = useState("");
  const formRef = useRef(null);

  // Close form when clicking outside
  useEffect(() => {
    if (!showPlaceholderForm) return;

    const handleClickOutside = (e) => {
      if (formRef.current && !formRef.current.contains(e.target)) {
        setShowPlaceholderForm(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPlaceholderForm]);

  const handleAddPlaceholder = (e) => {
    e.preventDefault();
    if (addPlaceholder(semesterKey, categoryPath, placeholderCredits, placeholderLabel || "TBD")) {
      setShowPlaceholderForm(false);
      setPlaceholderCredits(3);
      setPlaceholderLabel("");
    }
  };

  const handlePlusClick = () => {
    if (semesterStatus === "future") {
      setShowPlaceholderForm(true);
    }
  };

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

  // Determine if this column is the suggested drop target for the active drag
  const isSuggestedTarget = (() => {
    if (!active || !canDrop) return false;
    const dragData = active.data.current;
    const classification =
      dragData?.type === "eventlist-course"
        ? dragData.course?.classification
        : dragData?.type === "grid-course"
          ? dragData.item?.classification
          : null;
    return doesClassificationMatchCategory(classification, categoryName, validClassifications);
  })();

  // Cell background based on semester status (row)
  const getCellBackground = () => {
    const statusBg = {
      completed: "bg-green-50",
      current: "bg-green-50",
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

  // Suggestion highlight — subtle blue for the matching category column
  const getSuggestionClass = () => {
    if (!isSuggestedTarget || isOver) return "";
    return "ring-2 ring-blue-300 ring-inset bg-blue-50/50";
  };

  // Validation styling - uses ring-inset to compose with drag-over feedback
  const getValidationClasses = () => {
    if (hasConflicts) return "ring-2 ring-red-400 ring-inset";
    if (hasWarnings) return "ring-2 ring-amber-400 ring-inset";
    return "";
  };

  // Base border for cell structure
  const borderClass = "border-b border-r border-gray-100";
  const validationClass = getValidationClasses();

  // Border radius for bottom-right corner of grid
  const roundedClass = isLastCol ? "rounded-br-lg" : "";

  // Drag-over visual feedback (takes precedence over validation styling)
  const dragOverClass = getDragOverClasses();
  const suggestionClass = getSuggestionClass();

  // Combined ring class: drag-over > suggestion > validation
  const ringClass = dragOverClass || suggestionClass || validationClass;

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

      {/* Add more button for cells with courses (future semesters only) */}
      {courses.length > 0 && semesterStatus === "future" && !showPlaceholderForm && (
        <button
          onClick={handlePlusClick}
          className="text-gray-300 text-xs hover:text-gray-500 hover:bg-gray-100 rounded px-1 py-0.5 transition-colors self-start"
          title="Add placeholder course"
        >
          + Add
        </button>
      )}

      {/* Empty state - clickable add placeholder for future semesters */}
      {courses.length === 0 && semesterStatus === "future" && !showPlaceholderForm && (
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={handlePlusClick}
            className="text-gray-300 text-lg hover:text-gray-500 hover:bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center transition-colors"
            title="Add placeholder course"
          >
            +
          </button>
        </div>
      )}

      {/* Placeholder form */}
      {showPlaceholderForm && (
        <form
          ref={formRef}
          onSubmit={handleAddPlaceholder}
          className="bg-white border border-gray-300 rounded-md p-2 shadow-sm space-y-2"
        >
          <div>
            <label className="block text-[10px] text-gray-600 mb-0.5">Credits (ECTS)</label>
            <input
              type="number"
              min="1"
              max="30"
              value={placeholderCredits}
              onChange={(e) => setPlaceholderCredits(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-600 mb-0.5">Label (optional)</label>
            <input
              type="text"
              value={placeholderLabel}
              onChange={(e) => setPlaceholderLabel(e.target.value)}
              placeholder="e.g., Elective"
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-1">
            <button
              type="submit"
              className="flex-1 bg-blue-500 text-white text-xs px-2 py-1 rounded hover:bg-blue-600 transition-colors"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowPlaceholderForm(false)}
              className="flex-1 bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
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
  isLastCol: PropTypes.bool.isRequired,
  isCollapsed: PropTypes.bool.isRequired,
  isCategoryComplete: PropTypes.bool.isRequired,
  categoryName: PropTypes.string.isRequired,
  validClassifications: PropTypes.arrayOf(PropTypes.string),
};

export default PlanCell;
