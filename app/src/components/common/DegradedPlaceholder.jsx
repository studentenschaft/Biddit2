import PropTypes from "prop-types";
import { IconClock } from "@tabler/icons-react";

/**
 * Reusable placeholder shown in place of an SHSG-backed feature while
 * degraded mode is active (see `helpers/degradedModeService.js`).
 */
const DegradedPlaceholder = ({ feature, compact = false, className = "" }) => {
  const title = feature
    ? `${feature} is taking a short break`
    : "Temporarily unavailable";

  const body =
    "This feature is paused during the semester-start usage spike. Course browsing, calendar and transcript remain available — we'll be back soon.";

  if (compact) {
    return (
      <p className={`text-sm text-gray-500 ${className}`.trim()}>
        {title} — course browsing, calendar and transcript remain available.
      </p>
    );
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 ${className}`.trim()}
    >
      <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
        <IconClock className="h-5 w-5 text-gray-500" aria-hidden="true" />
      </span>
      <div>
        <p className="font-semibold text-gray-800">{title}</p>
        <p className="mt-1 text-sm text-gray-500">{body}</p>
      </div>
    </div>
  );
};

DegradedPlaceholder.propTypes = {
  feature: PropTypes.string,
  compact: PropTypes.bool,
  className: PropTypes.string,
};

export default DegradedPlaceholder;
