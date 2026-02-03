/**
 * ProgramHeader.jsx
 *
 * Displays program name, overall progress bar, and credit statistics
 * at the top of the Curriculum Map view.
 * Uses HSG color palette to match StudyOverview styling.
 */

import PropTypes from "prop-types";

const ProgramHeader = ({ program }) => {
  if (!program) return null;

  const {
    name,
    totalRequired,
    totalEarned,
    totalPlanned,
    completionPercentage,
    estimatedCompletion,
  } = program;

  // Progress bar segments
  const earnedPercent = Math.min((totalEarned / totalRequired) * 100, 100);
  const plannedPercent = Math.min(
    ((totalEarned + totalPlanned) / totalRequired) * 100 - earnedPercent,
    100 - earnedPercent
  );

  return (
    <div className="space-y-3">
      {/* Title and stats row */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">{name}</h1>
        <div className="text-sm text-gray-600">
          <span className="font-semibold text-hsg-700">{totalEarned}</span>
          {totalPlanned > 0 && (
            <>
              {" + "}
              <span className="font-semibold text-blue-600">{totalPlanned}</span>
              <span className="text-gray-500"> planned</span>
            </>
          )}
          {" / "}
          <span className="font-semibold">{totalRequired}</span>
          <span className="text-gray-500"> ECTS</span>
          <span className="ml-2 text-gray-400">({completionPercentage}%)</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          {/* Earned (completed) segment */}
          <div
            className="absolute h-full bg-hsg-600 rounded-l-full transition-all duration-500"
            style={{ width: `${earnedPercent}%` }}
            title={`${totalEarned} ECTS completed`}
          />
          {/* Planned segment */}
          {totalPlanned > 0 && (
            <div
              className="absolute h-full bg-blue-400 transition-all duration-500"
              style={{
                left: `${earnedPercent}%`,
                width: `${plannedPercent}%`,
              }}
              title={`${totalPlanned} ECTS planned`}
            />
          )}
        </div>

        {/* Milestone markers */}
        <div className="absolute top-0 h-3 w-full pointer-events-none">
          {/* 50% marker */}
          <div
            className="absolute h-full w-px bg-gray-400/50"
            style={{ left: "50%" }}
          />
          {/* 100% marker */}
          <div
            className="absolute h-full w-px bg-gray-500"
            style={{ left: "100%" }}
          />
        </div>
      </div>

      {/* Estimated completion */}
      {estimatedCompletion && estimatedCompletion !== "Completed" && (
        <div className="text-xs text-gray-500">
          Estimated completion:{" "}
          <span className="font-medium text-gray-700">{estimatedCompletion}</span>
        </div>
      )}
      {estimatedCompletion === "Completed" && (
        <div className="text-xs text-hsg-700 font-medium flex items-center gap-1">
          <span>✓</span>
          <span>All requirements completed</span>
        </div>
      )}
    </div>
  );
};

ProgramHeader.propTypes = {
  program: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string.isRequired,
    totalRequired: PropTypes.number.isRequired,
    totalEarned: PropTypes.number.isRequired,
    totalPlanned: PropTypes.number.isRequired,
    completionPercentage: PropTypes.number.isRequired,
    estimatedCompletion: PropTypes.string,
  }),
};

export default ProgramHeader;
