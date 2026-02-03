/**
 * SemesterRow.jsx
 *
 * Row header cell showing semester information (key, status, credits).
 * Sticky positioned so it remains visible when scrolling horizontally.
 * Uses HSG color palette aligned with StudyOverview patterns.
 */

import PropTypes from "prop-types";

const SemesterRow = ({ semester, isLast }) => {
  const { key, status, totalCredits, plannedCredits } = semester;

  // Status-based styling using HSG colors
  const statusStyles = {
    completed: {
      bg: "bg-hsg-50",
      border: "border-l-hsg-600",
      icon: "✓",
      iconColor: "text-hsg-700",
      label: "Completed",
    },
    current: {
      bg: "bg-amber-50",
      border: "border-l-amber-500",
      icon: "●",
      iconColor: "text-amber-600",
      label: "Current",
    },
    future: {
      bg: "bg-gray-50",
      border: "border-l-gray-300",
      icon: "○",
      iconColor: "text-gray-400",
      label: "Planned",
    },
  };

  const style = statusStyles[status] || statusStyles.future;

  // Border radius for last row
  const roundedClass = isLast ? "rounded-bl-lg" : "";

  return (
    <div
      className={`${style.bg} ${style.border} ${roundedClass} border-l-4 p-2 sticky left-0 z-10 flex flex-col justify-center min-h-[75px]`}
    >
      {/* Semester key and status icon */}
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-sm text-gray-800">{key}</span>
        <span
          className={`${style.iconColor} text-xs`}
          title={style.label}
        >
          {style.icon}
        </span>
      </div>

      {/* Credit summary */}
      <div className="text-[10px] text-gray-600 mt-0.5">
        {totalCredits > 0 ? (
          <>
            <span className="font-semibold">{totalCredits}</span>
            <span className="text-gray-500 ml-0.5">ECTS</span>
          </>
        ) : (
          <span className="text-gray-400 italic">No courses</span>
        )}
      </div>

      {/* Breakdown for non-completed semesters */}
      {status !== "completed" && plannedCredits > 0 && (
        <div className="text-[9px] text-blue-600 mt-0.5">
          {plannedCredits} planned
        </div>
      )}
    </div>
  );
};

SemesterRow.propTypes = {
  semester: PropTypes.shape({
    key: PropTypes.string.isRequired,
    status: PropTypes.oneOf(["completed", "current", "future"]).isRequired,
    totalCredits: PropTypes.number,
    completedCredits: PropTypes.number,
    plannedCredits: PropTypes.number,
    courseCount: PropTypes.number,
  }).isRequired,
  isLast: PropTypes.bool,
};

export default SemesterRow;
