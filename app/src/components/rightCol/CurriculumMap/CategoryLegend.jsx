/**
 * CategoryLegend.jsx
 *
 * Simplified legend matching StudyOverview style.
 * Shows essential course status indicators only.
 */

const CategoryLegend = () => {
  const legendItems = [
    { color: "bg-green-600", label: "Completed" },
    { color: "bg-green-200", label: "Enrolled" },
    { color: "bg-gray-200", label: "Planned" },
  ];

  return (
    <div className="flex flex-row items-center justify-center w-full py-4 flex-wrap gap-4">
      {legendItems.map((item) => (
        <div key={item.label} className="flex items-center text-sm">
          <div className={`h-4 w-4 rounded mr-2 ${item.color}`} />
          <div className="text-gray-600">{item.label}</div>
        </div>
      ))}
    </div>
  );
};

export default CategoryLegend;
