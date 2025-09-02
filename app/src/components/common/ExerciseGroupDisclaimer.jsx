import { InformationCircleIcon } from "@heroicons/react/outline";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { EXERCISE_GROUP_TOOLTIP_TEXT } from "../../constants/ratingTooltips";

export default function ExerciseGroupDisclaimer() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
      <div className="flex items-start">
        <InformationCircleIcon 
          className="h-5 w-5 text-amber-600 mt-0.5 mr-2 flex-shrink-0"
          data-tooltip-id="exercise-group-disclaimer"
          data-tooltip-content={EXERCISE_GROUP_TOOLTIP_TEXT}
        />
        <div className="text-sm text-amber-800">
          <p className="font-medium">Exercise Group Rating Notice</p>
          <p className="text-xs mt-1">
            Teaching assistants may change between semesters. These ratings might not reflect the current instructor.
          </p>
        </div>
      </div>
      <ReactTooltip
        id="exercise-group-disclaimer"
        place="top"
        style={{
          backgroundColor: "#f9fafb",
          color: "#111827",
          border: "1px solid #d1d5db",
          borderRadius: "0.375rem",
          fontSize: "0.875rem",
          maxWidth: "300px"
        }}
      />
    </div>
  );
}