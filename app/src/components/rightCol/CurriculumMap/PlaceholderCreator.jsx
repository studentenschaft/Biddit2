/**
 * PlaceholderCreator.jsx
 *
 * Compact input row for creating placeholder courses. Users fill in a label and
 * credit value, then drag the preview chip directly onto a grid cell.
 * Sits between PlanSwitcher and the CurriculumGrid.
 */

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const PlaceholderCreator = () => {
  const [label, setLabel] = useState("");
  const [credits, setCredits] = useState(3);

  const isValid = credits >= 1 && credits <= 30;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: "placeholder-creator",
      data: {
        type: "placeholder-creator",
        credits,
        label: label || "TBD",
      },
      disabled: !isValid,
    });

  const chipStyle = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div className="flex items-center gap-2 mt-2 px-1">
      <span className="text-xs text-gray-500 whitespace-nowrap">Add a Placeholder Course:</span>
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label (e.g. Elective)"
        className="border border-gray-300 rounded px-2 py-1 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      {/* Credits input */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="1"
          max="30"
          value={credits}
          onChange={(e) => setCredits(Number(e.target.value))}
          className="border border-gray-300 rounded px-2 py-1 text-sm w-14 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-xs text-gray-500">ECTS</span>
      </div>

      {/* Drag hint + draggable chip */}
      {isValid && (
        <>
          <span className="text-xs text-gray-400 whitespace-nowrap">Drag into grid →</span>
          <div
            ref={setNodeRef}
            style={chipStyle}
            {...listeners}
            {...attributes}
            className={`flex items-center gap-1 border border-dashed border-gray-400 rounded-md px-2 py-1 text-xs text-gray-600 bg-gray-50 select-none transition-shadow ${
              isDragging
                ? "opacity-50 cursor-grabbing shadow-md"
                : "cursor-grab hover:shadow-md hover:border-gray-500"
            }`}
            title="Drag onto a cell to place"
          >
            <span>⠿</span>
            <span className="truncate max-w-[80px]">{label || "TBD"}</span>
            <span className="text-gray-400">·</span>
            <span>{credits}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default PlaceholderCreator;
