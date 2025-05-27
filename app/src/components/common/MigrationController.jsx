import { useState, useEffect } from "react";
import { useMigrationManager } from "../helpers/useMigrationManager";

/**
 * Migration component to help transition from old state management to unified system
 * This can be temporarily included in the app during migration period
 */
export function MigrationController() {
  const { migrateToUnifiedSystem, getMigrationSummary, isMigrationNeeded } =
    useMigrationManager();
  const [migrationStatus, setMigrationStatus] = useState("idle"); // idle, running, success, error
  const [summary, setSummary] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Get migration summary on component mount
    setSummary(getMigrationSummary());
  }, [getMigrationSummary]);

  const handleMigration = async () => {
    setMigrationStatus("running");
    try {
      const success = await migrateToUnifiedSystem();
      if (success) {
        setMigrationStatus("success");
        // Refresh summary after migration
        setSummary(getMigrationSummary());
      } else {
        setMigrationStatus("error");
      }
    } catch (error) {
      console.error("Migration error:", error);
      setMigrationStatus("error");
    }
  };

  if (!summary) {
    return <div className="p-4">Loading migration summary...</div>;
  }

  const needsMigration = isMigrationNeeded();

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-2xl mx-auto my-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        Course Data Migration Manager
      </h2>

      <div className="mb-6">
        <div className="flex items-center mb-2">
          <span
            className={`inline-block w-3 h-3 rounded-full mr-2 ${
              needsMigration ? "bg-yellow-500" : "bg-green-500"
            }`}
          ></span>
          <span className="font-semibold">
            {needsMigration ? "Migration Available" : "System Up to Date"}
          </span>
        </div>

        {needsMigration && (
          <p className="text-sm text-gray-600 mb-4">
            Old course data format detected. Click migrate to transition to the
            new unified system.
          </p>
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Migration Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Course Info Semesters:</span>{" "}
            {summary.courseInfoSemesters}
          </div>
          <div>
            <span className="font-medium">Enrolled Courses:</span>{" "}
            {summary.enrolledCoursesSemesters}
          </div>
          <div>
            <span className="font-medium">Local Selected:</span>{" "}
            {summary.localSelectedSemesters}
          </div>
          <div>
            <span className="font-medium">Semester Key Selected:</span>{" "}
            {summary.semesterKeySelectedSemesters}
          </div>
          <div>
            <span className="font-medium">Course Ratings:</span>{" "}
            {summary.totalRatings}
          </div>
          <div>
            <span className="font-medium">Semester Mappings:</span>{" "}
            {summary.availableSemesterMappings}
          </div>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          {showDetails ? "Hide" : "Show"} Detailed Breakdown
        </button>

        {showDetails && summary.detailedCounts && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-2">Per-Semester Course Counts:</h4>
            {Object.entries(summary.detailedCounts).map(
              ([semester, counts]) => (
                <div key={semester} className="mb-2">
                  <span className="font-medium">{semester}:</span>
                  <div className="ml-4 text-sm">
                    Available: {counts.available}, Enrolled: {counts.enrolled},
                    Selected: {counts.localSelected}
                    {counts.semesterKeySelected !== undefined &&
                      `, Semester-keyed: ${counts.semesterKeySelected}`}
                  </div>
                </div>
              )
            )}

            {summary.semesterMapping && (
              <div className="mt-4">
                <span className="font-medium">Semester Mapping:</span>
                <div className="ml-4 text-sm">
                  {Object.entries(summary.semesterMapping).map(
                    ([numKey, shortName]) => (
                      <div key={numKey}>
                        Index {numKey} → {shortName}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {needsMigration && (
        <div className="mb-6">
          <button
            onClick={handleMigration}
            disabled={migrationStatus === "running"}
            className={`px-6 py-3 rounded-lg font-semibold text-white ${
              migrationStatus === "running"
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
            }`}
          >
            {migrationStatus === "running" ? "Migrating..." : "Start Migration"}
          </button>
        </div>
      )}

      {migrationStatus === "success" && (
        <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
          <h4 className="font-semibold">Migration Completed Successfully!</h4>
          <p className="text-sm mt-1">
            All course data has been migrated to the unified system. The old
            data structure can now be gradually deprecated.
          </p>
        </div>
      )}

      {migrationStatus === "error" && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          <h4 className="font-semibold">Migration Failed</h4>
          <p className="text-sm mt-1">
            There was an error during migration. Check the console for details.
          </p>
          <button
            onClick={() => setMigrationStatus("idle")}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      <div className="mt-6 text-xs text-gray-500">
        <p>
          This migration controller can be removed once the transition is
          complete and all components are using the unified system.
        </p>
      </div>
    </div>
  );
}

export default MigrationController;
