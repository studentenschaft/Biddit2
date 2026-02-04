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
  isParentComplete = false,
}) => {
  const {
    name,
    minCredits,
    maxCredits,
    earnedCredits = 0,
    plannedCredits = 0,
    isComplete,
  } = category;

  // Column is highlighted if this category OR its parent is complete
  const isHighlighted = isComplete || isParentComplete;

  // Total credits for display
  const totalCredits = earnedCredits + plannedCredits;
  const targetCredits = maxCredits || minCredits || 0;

  // Calculate fill percentage for visual progress
  const fillPercentage = targetCredits > 0
    ? Math.min(100, Math.round((totalCredits / targetCredits) * 100))
    : 0;

  // Truncate long names
  const displayName = name.length > 22 ? name.substring(0, 20) + "..." : name;

  // Border radius for first/last columns when no parent headers
  const roundedClasses = `${isFirst ? "rounded-tl-lg" : ""} ${
    isLast ? "rounded-tr-lg" : ""
  }`;

  // Collapsed view - vertical name with expand button
  if (isCollapsed) {
    const abbreviation = name.length > 10 ? name.substring(0, 8) + "…" : name;

    return (
      <div
        className={`relative border-b border-gray-200 min-h-[70px] py-1 cursor-pointer overflow-hidden transition-colors ${roundedClasses}`}
        style={{ backgroundColor: '#f9fafb' }}
        onClick={onToggleCollapse}
        title={`${name} (click to expand)`}
      >
        {/* Progress fill background - highlighted if this or parent is complete */}
        <div
          className={`absolute inset-y-0 left-0 transition-all duration-300 ${
            isHighlighted ? 'bg-green-100' : 'bg-gray-200'
          }`}
          style={{ width: isHighlighted ? '100%' : `${fillPercentage}%` }}
        />

        {/* Content layer */}
        <div className="relative z-10 flex flex-col items-center justify-between h-full min-h-[62px]">
          {/* Vertical rotated name */}
          <div
            className="text-[9px] font-medium text-gray-600 whitespace-nowrap overflow-hidden"
            style={{
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              transform: "rotate(180deg)",
              maxHeight: "50px",
            }}
          >
            {abbreviation}
          </div>

          {/* Expand icon */}
          <ChevronRightIcon className="w-3 h-3 text-gray-500" />

          {/* Completion indicator via green dot - only for this category's own completion */}
          {isComplete && (
            <div className="w-2 h-2 rounded-full bg-green-600" title="Complete" />
          )}
        </div>
      </div>
    );
  }

  // Expanded view with fill progress indicator
  return (
    <div
      className={`relative p-2 border-b border-gray-200 flex flex-col justify-between min-h-[70px] overflow-hidden ${roundedClasses}`}
      style={{ backgroundColor: '#f9fafb' }}
      title={name}
    >
      {/* Progress fill background - highlighted if this or parent is complete */}
      <div
        className={`absolute inset-y-0 left-0 transition-all duration-300 ${
          isHighlighted ? 'bg-green-100' : 'bg-gray-200'
        }`}
        style={{ width: isHighlighted ? '100%' : `${fillPercentage}%` }}
      />

      {/* Content layer */}
      <div className="relative z-10 flex flex-col justify-between h-full">
        {/* Header row with name and collapse button */}
        <div className="flex items-start justify-between gap-1">
          <div className="text-xs font-semibold text-gray-800 leading-tight flex-1">
            {displayName}
          </div>
          <button
            onClick={onToggleCollapse}
            className="p-0.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
            title="Collapse column"
          >
            <ChevronLeftIcon className="w-3 h-3 text-gray-500" />
          </button>
        </div>

        {/* Credit info - simplified X/Y ECTS format */}
        <div className="flex items-center justify-between mt-auto">
          <div className="text-[10px] text-gray-700">
            <span className={isComplete ? "font-semibold text-green-700" : "font-medium"}>
              {totalCredits}
            </span>
            <span className="text-gray-500">
              {" / "}
              {targetCredits > 0 ? targetCredits : "?"}
            </span>
            <span className="text-gray-500 ml-0.5">ECTS</span>
          </div>
          {isComplete && (
            <div className="w-2 h-2 rounded-full bg-green-600" title="Complete" />
          )}
        </div>
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
  isParentComplete: PropTypes.bool,
};

CategoryHeader.defaultProps = {
  isFirst: false,
  isLast: false,
  isCollapsed: false,
  onToggleCollapse: () => {},
  isParentComplete: false,
};

export default CategoryHeader;
