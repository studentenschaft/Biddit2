/**
 * CategoryLegend.jsx
 *
 * Legend explaining the color codes and status indicators used in the grid.
 * Positioned at the bottom of the Curriculum Map view.
 * Uses HSG color palette for consistency.
 */

const CategoryLegend = () => {
  const legendItems = [
    {
      color: "bg-hsg-100 border-hsg-600",
      label: "Completed",
      icon: "✓",
    },
    {
      color: "bg-amber-100 border-amber-500",
      label: "In Progress",
      icon: "●",
    },
    {
      color: "bg-blue-100 border-blue-400",
      label: "Planned",
      icon: "○",
    },
    {
      color: "bg-gray-50 border-gray-300 border-dashed",
      label: "Placeholder",
      icon: "...",
    },
  ];

  const statusItems = [
    {
      indicator: "border-l-4 border-l-hsg-600 bg-hsg-50",
      label: "Past semester",
    },
    {
      indicator: "border-l-4 border-l-amber-500 bg-amber-50",
      label: "Current semester",
    },
    {
      indicator: "border-l-4 border-l-gray-300 bg-gray-50",
      label: "Future semester",
    },
  ];

  return (
    <div className="px-4 py-2.5 flex flex-wrap items-center gap-4 text-xs">
      {/* Course status legend */}
      <div className="flex items-center gap-3">
        <span className="text-gray-500 font-medium">Courses:</span>
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className={`w-5 h-4 ${item.color} border rounded flex items-center justify-center text-[8px]`}
            >
              {item.icon}
            </div>
            <span className="text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px h-4 bg-gray-300" />

      {/* Semester status legend */}
      <div className="flex items-center gap-3">
        <span className="text-gray-500 font-medium">Semesters:</span>
        {statusItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-4 h-4 ${item.indicator} rounded-sm`} />
            <span className="text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Validation indicators */}
      <div className="hidden md:flex items-center gap-3">
        <span className="text-gray-500 font-medium">Alerts:</span>
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 bg-red-100 border-2 border-red-400 rounded-sm" />
          <span className="text-gray-600">Conflict</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 bg-amber-100 border-2 border-amber-400 rounded-sm" />
          <span className="text-gray-600">Warning</span>
        </div>
      </div>
    </div>
  );
};

export default CategoryLegend;
