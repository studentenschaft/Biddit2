/**
 * CategoryHeader.jsx
 *
 * Column header for a requirement category in the curriculum grid.
 * Shows category name, credit requirements, and a mini progress bar.
 * Supports collapsed state to minimize column width.
 */

import PropTypes from "prop-types";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/solid";

const CategoryHeader = ({
  category,
  isFirst,
  isLast,
  isCollapsed,
  onToggleCollapse,
}) => {
  const {
    name,
    minCredits,
    maxCredits,
    earnedCredits = 0,
    plannedCredits = 0,
    isComplete,
    isOverfilled,
  } = category;

  // Calculate progress percentages
  const targetCredits = maxCredits || minCredits || 1;
  const earnedPercent = Math.min((earnedCredits / targetCredits) * 100, 100);
  const plannedPercent = Math.min(
    ((earnedCredits + plannedCredits) / targetCredits) * 100 - earnedPercent,
    100 - earnedPercent
  );

  // Status indicators using HSG colors
  const statusColor = isComplete
    ? "bg-hsg-50 border-hsg-300"
    : isOverfilled
    ? "bg-amber-50 border-amber-300"
    : "bg-stone-100 border-stone-200";

  // Truncate long names
  const displayName = name.length > 22 ? name.substring(0, 20) + "..." : name;

  // Border radius for first/last columns when no parent headers
  const roundedClasses = `${isFirst ? "rounded-tl-lg" : ""} ${
    isLast ? "rounded-tr-lg" : ""
  }`;

  // Collapsed view - vertical name with expand button
  if (isCollapsed) {
    // Get first few characters or abbreviation for collapsed view
    const abbreviation = name.length > 10 ? name.substring(0, 8) + "…" : name;

    return (
      <div
        className={`${statusColor} border-b-2 flex flex-col items-center justify-between min-h-[85px] py-1 cursor-pointer hover:bg-stone-200 transition-colors ${roundedClasses}`}
        onClick={onToggleCollapse}
        title={`${name} (click to expand)`}
      >
        {/* Vertical rotated name */}
        <div
          className="text-[9px] font-medium text-gray-600 whitespace-nowrap overflow-hidden"
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            transform: "rotate(180deg)",
            maxHeight: "60px",
          }}
        >
          {abbreviation}
        </div>

        {/* Expand icon */}
        <ChevronRightIcon className="w-3 h-3 text-gray-500" />

        {/* Status indicator dot */}
        {isComplete && (
          <div className="w-2 h-2 rounded-full bg-hsg-600" title="Complete" />
        )}
      </div>
    );
  }

  // Expanded view (normal)
  return (
    <div
      className={`p-2 ${statusColor} border-b-2 flex flex-col justify-between min-h-[85px] ${roundedClasses}`}
      title={name}
    >
      {/* Header row with name and collapse button */}
      <div className="flex items-start justify-between gap-1">
        <div className="text-xs font-semibold text-gray-800 leading-tight flex-1">
          {displayName}
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-0.5 hover:bg-stone-200 rounded transition-colors flex-shrink-0"
          title="Collapse column"
        >
          <ChevronLeftIcon className="w-3 h-3 text-gray-500" />
        </button>
      </div>

      {/* Credit info */}
      <div className="text-[10px] mb-1.5">
        <span className="font-medium text-hsg-700">{earnedCredits}</span>
        {plannedCredits > 0 && (
          <span className="text-blue-600 font-medium">+{plannedCredits}</span>
        )}
        <span className="text-gray-500">
          {" / "}
          {minCredits === maxCredits ? (
            <>{maxCredits}</>
          ) : (
            <>
              {minCredits}-{maxCredits}
            </>
          )}
          <span className="text-[9px] ml-0.5">ECTS</span>
        </span>
      </div>

      {/* Mini progress bar */}
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        {/* Earned segment */}
        <div
          className="h-full bg-hsg-600 float-left transition-all duration-300"
          style={{ width: `${earnedPercent}%` }}
        />
        {/* Planned segment */}
        {plannedCredits > 0 && (
          <div
            className="h-full bg-blue-400 float-left transition-all duration-300"
            style={{ width: `${plannedPercent}%` }}
          />
        )}
      </div>

      {/* Status icons */}
      <div className="flex justify-end mt-1">
        {isComplete && (
          <span className="text-hsg-700 text-xs font-bold" title="Requirement fulfilled">
            ✓
          </span>
        )}
        {isOverfilled && !isComplete && (
          <span className="text-amber-600 text-xs" title="Exceeds maximum">
            !
          </span>
        )}
      </div>
    </div>
  );
};

CategoryHeader.propTypes = {
  category: PropTypes.shape({
    path: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    minCredits: PropTypes.number,
    maxCredits: PropTypes.number,
    earnedCredits: PropTypes.number,
    plannedCredits: PropTypes.number,
    isComplete: PropTypes.bool,
    isOverfilled: PropTypes.bool,
  }).isRequired,
  isFirst: PropTypes.bool,
  isLast: PropTypes.bool,
  isCollapsed: PropTypes.bool,
  onToggleCollapse: PropTypes.func,
};

export default CategoryHeader;
