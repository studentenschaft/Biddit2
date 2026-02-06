/**
 * ProgramHeader.jsx
 *
 * Displays program name, overall progress bar, and credit statistics
 * at the top of the Curriculum Map view.
 * Uses HSG color palette to match StudyOverview styling.
 */

import PropTypes from "prop-types";
import { QuestionMarkCircleIcon } from "@heroicons/react/outline";
import { Tooltip as ReactTooltip } from "react-tooltip";

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
      <div className="py-2 pl-2 pr-3 text-xl font-bold bg-gray-100 rounded flex items-center justify-between">
        {name}
        <button
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 cursor-help flex-shrink-0 ml-2 transition-colors"
          data-tooltip-id="curriculum-map-help"
        >
          <QuestionMarkCircleIcon className="h-4 w-4" />
          How this works
        </button>
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

      <ReactTooltip
        id="curriculum-map-help"
        place="bottom"
        style={{
          backgroundColor: "#f9fafb",
          color: "#111827",
          border: "1px solid #d1d5db",
          borderRadius: "0.5rem",
          fontSize: "0.8125rem",
          maxWidth: "340px",
          padding: "12px 16px",
          zIndex: 50,
        }}
        render={() => (
          <div>
            <p style={{ margin: "0 0 8px 0" }}>
              This view allows you to plan your entire study program.
            </p>
            <ul style={{ margin: 0, paddingLeft: "18px", lineHeight: "1.6", listStyleType: "disc" }}>
              <li>Drag courses from the list on the left into any future semester cell</li>
              <li>Completed and enrolled courses appear automatically from your transcript</li>
              <li>Click &quot;+&quot; in an empty cell to add a placeholder</li>
              <li>Create multiple plans with the tabs below to compare study paths</li>
              <li>Right-click a plan tab to rename, duplicate, or delete</li>
            </ul>
          </div>
        )}
      />
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
