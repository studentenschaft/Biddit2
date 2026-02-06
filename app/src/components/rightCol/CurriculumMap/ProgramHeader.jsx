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
      {/* Title - matches StudyOverview header style */}
      <div className="py-2 pl-2 text-xl font-bold bg-gray-100 rounded">
        {name}
      </div>

      {/* Progress section */}
      <div className="px-2">
        {/* Credits summary */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-green-700">{totalEarned}</span>
            {totalPlanned > 0 && (
              <>
                <span className="text-gray-400"> + </span>
                <span className="font-semibold text-gray-500">{totalPlanned}</span>
                <span className="text-gray-400"> planned</span>
              </>
            )}
            <span className="text-gray-400"> / </span>
            <span className="font-semibold">{totalRequired}</span>
            <span className="text-gray-500"> ECTS</span>
          </div>
          <span className="text-sm font-medium text-gray-500">{completionPercentage}%</span>
        </div>

        {/* Progress bar - simplified without milestone markers */}
        <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden flex">
          {/* Earned (completed) segment */}
          <div
            className="h-full bg-green-600 transition-all duration-500"
            style={{ width: `${earnedPercent}%` }}
            title={`${totalEarned} ECTS completed`}
          />
          {/* Planned segment */}
          {totalPlanned > 0 && (
            <div
              className="h-full bg-gray-400 transition-all duration-500"
              style={{ width: `${plannedPercent}%` }}
              title={`${totalPlanned} ECTS planned`}
            />
          )}
        </div>

        {/* Completion status */}
        {estimatedCompletion === "Completed" && (
          <div className="text-xs text-green-700 font-medium mt-2">
            All requirements completed
          </div>
        )}
      </div>
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
