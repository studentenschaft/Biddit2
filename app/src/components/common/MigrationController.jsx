import { useState, useEffect } from "react";
import { useRecoilValue } from "recoil";
import { useMigrationManager } from "../helpers/useMigrationManager";
import { unifiedCourseDataState } from "../recoil/unifiedCourseDataAtom";
import { courseInfoState } from "../recoil/courseInfoAtom";
import { enrolledCoursesState } from "../recoil/enrolledCoursesAtom";
import { localSelectedCoursesState } from "../recoil/localSelectedCoursesAtom";
import { localSelectedCoursesSemKeyState } from "../recoil/localSelectedCoursesSemKeyAtom";
import { shsgCourseRatingsState } from "../recoil/shsgCourseRatingsAtom";

/**
 * Migration component to help transition from old state management to unified system
 * This can be temporarily included in the app during migration period
 */
export function MigrationController() {
  const { migrateToUnifiedSystem, getMigrationSummary, isMigrationNeeded } =
    useMigrationManager();

  // Get all the current state values for visualization
  const unifiedCourseData = useRecoilValue(unifiedCourseDataState);
  const courseInfo = useRecoilValue(courseInfoState);
  const enrolledCourses = useRecoilValue(enrolledCoursesState);
  const localSelectedCourses = useRecoilValue(localSelectedCoursesState);
  const localSelectedCoursesSemKey = useRecoilValue(
    localSelectedCoursesSemKeyState
  );
  const shsgCourseRatings = useRecoilValue(shsgCourseRatingsState);

  const [migrationStatus, setMigrationStatus] = useState("idle"); // idle, running, success, error
  const [summary, setSummary] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showOldState, setShowOldState] = useState(false);
  const [showNewState, setShowNewState] = useState(false);
  const [activeTab, setActiveTab] = useState("summary"); // summary, compare, debug
  useEffect(() => {
    // Get migration summary on component mount
    setSummary(getMigrationSummary());    // Log unified course data for debugging
    console.log("🚀 Unified Course Data:", unifiedCourseData);
    console.log("📚 Old Course Info:", courseInfo);
    console.log("📝 Old Enrolled Courses:", enrolledCourses);
    console.log("📝 Enrolled Courses Keys:", Object.keys(enrolledCourses));
    console.log("📝 Enrolled Courses Values:", Object.values(enrolledCourses));
    console.log("⭐ Old Local Selected:", localSelectedCourses);
    console.log("🔑 Semester Key Selected:", localSelectedCoursesSemKey);
    console.log("⭐ Course Ratings:", shsgCourseRatings);
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    unifiedCourseData,
    courseInfo,
    enrolledCourses,
    localSelectedCourses,
    localSelectedCoursesSemKey,
    shsgCourseRatings,
  ]);

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
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-6xl mx-auto my-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        Course Data Migration Manager
      </h2>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === "summary"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Migration Summary
        </button>
        <button
          onClick={() => setActiveTab("compare")}
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === "compare"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          State Comparison
        </button>
        <button
          onClick={() => setActiveTab("debug")}
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === "debug"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Debug Views
        </button>
      </div>

      {/* Summary Tab */}
      {activeTab === "summary" && (
        <div>
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
                Old course data format detected. You can migrate to the unified
                system or compare states below.
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
                <span className="font-medium">Unified Semesters:</span>{" "}
                {Object.keys(unifiedCourseData).length}
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
                <h4 className="font-semibold mb-2">
                  Per-Semester Course Counts:
                </h4>
                {Object.entries(summary.detailedCounts).map(
                  ([semester, counts]) => (
                    <div key={semester} className="mb-2">
                      <span className="font-medium">{semester}:</span>
                      <div className="ml-4 text-sm">
                        Available: {counts.available}, Enrolled:{" "}
                        {counts.enrolled}, Selected: {counts.localSelected}
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
                {migrationStatus === "running"
                  ? "Migrating..."
                  : "Start Migration"}
              </button>
            </div>
          )}

          {migrationStatus === "success" && (
            <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
              <h4 className="font-semibold">
                Migration Completed Successfully!
              </h4>
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
                There was an error during migration. Check the console for
                details.
              </p>
              <button
                onClick={() => setMigrationStatus("idle")}
                className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* State Comparison Tab */}
      {activeTab === "compare" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Old State Column */}
          <div className="bg-red-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-red-800">
              Old State Management
            </h3>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-red-700">
                  Course Info (by index)
                </h4>
                <div className="text-sm bg-white p-2 rounded border">
                  {Object.keys(courseInfo).length > 0 ? (
                    Object.entries(courseInfo).map(([index, courses]) => (
                      <div key={index} className="mb-1">
                        <span className="font-mono text-xs bg-gray-100 px-1 rounded">
                          [{index}]
                        </span>
                        : {courses?.length || 0} courses
                      </div>
                    ))
                  ) : (
                    <span className="text-gray-500">No data</span>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-red-700">
                  Enrolled Courses (by index)
                </h4>
                <div className="text-sm bg-white p-2 rounded border">
                  {Object.keys(enrolledCourses).length > 0 ? (
                    Object.entries(enrolledCourses).map(([index, courses]) => (
                      <div key={index} className="mb-1">
                        <span className="font-mono text-xs bg-gray-100 px-1 rounded">
                          [{index}]
                        </span>
                        : {courses?.length || 0} courses
                      </div>
                    ))
                  ) : (
                    <span className="text-gray-500">No data</span>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-red-700">
                  Local Selected (by index)
                </h4>
                <div className="text-sm bg-white p-2 rounded border">
                  {Object.keys(localSelectedCourses).length > 0 ? (
                    Object.entries(localSelectedCourses).map(
                      ([index, courses]) => (
                        <div key={index} className="mb-1">
                          <span className="font-mono text-xs bg-gray-100 px-1 rounded">
                            [{index}]
                          </span>
                          : {courses?.length || 0} courses
                        </div>
                      )
                    )
                  ) : (
                    <span className="text-gray-500">No data</span>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-red-700">
                  Semester Key Selected
                </h4>
                <div className="text-sm bg-white p-2 rounded border">
                  {Object.keys(localSelectedCoursesSemKey).length > 0 ? (
                    Object.entries(localSelectedCoursesSemKey).map(
                      ([semKey, courses]) => (
                        <div key={semKey} className="mb-1">
                          <span className="font-mono text-xs bg-gray-100 px-1 rounded">
                            {semKey}
                          </span>
                          : {courses?.length || 0} courses
                        </div>
                      )
                    )
                  ) : (
                    <span className="text-gray-500">No data</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* New State Column */}
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-green-800">
              Unified State Management
            </h3>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-green-700">
                  Unified Course Data
                </h4>
                <div className="text-sm bg-white p-2 rounded border">
                  {Object.keys(unifiedCourseData).length > 0 ? (
                    Object.entries(unifiedCourseData).map(
                      ([semester, data]) => (
                        <div key={semester} className="mb-2 border-b pb-2">
                          <div className="font-mono text-xs bg-gray-100 px-1 rounded mb-1">
                            {semester}
                          </div>
                          <div className="ml-2 text-xs">
                            <div>Available: {data.available?.length || 0}</div>
                            <div>Enrolled: {data.enrolled?.length || 0}</div>
                            <div>Selected: {data.selected?.length || 0}</div>
                            <div>
                              Ratings: {Object.keys(data.ratings || {}).length}
                            </div>
                            <div>
                              Last Fetched:{" "}
                              {data.lastFetched
                                ? new Date(data.lastFetched).toLocaleString()
                                : "Never"}
                            </div>
                          </div>
                        </div>
                      )
                    )
                  ) : (
                    <span className="text-gray-500">No unified data yet</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debug Tab */}
      {activeTab === "debug" && (
        <div className="space-y-6">
          <div className="flex space-x-4">
            <button
              onClick={() => setShowOldState(!showOldState)}
              className="px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200"
            >
              {showOldState ? "Hide" : "Show"} Old State JSON
            </button>
            <button
              onClick={() => setShowNewState(!showNewState)}
              className="px-4 py-2 bg-green-100 text-green-800 rounded hover:bg-green-200"
            >
              {showNewState ? "Hide" : "Show"} Unified State JSON
            </button>
            <button
              onClick={() =>
                console.log("🚀 Full State Dump:", {
                  unifiedCourseData,
                  courseInfo,
                  enrolledCourses,
                  localSelectedCourses,
                  localSelectedCoursesSemKey,
                  shsgCourseRatings,
                })
              }
              className="px-4 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
            >
              Log All States to Console
            </button>
          </div>

          {showOldState && (
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-medium text-red-800 mb-2">
                Old State Structure
              </h4>
              <div className="space-y-3">
                <details className="bg-white p-2 rounded border">
                  <summary className="cursor-pointer font-medium">
                    Course Info
                  </summary>
                  <pre className="text-xs mt-2 overflow-auto max-h-40">
                    {JSON.stringify(courseInfo, null, 2)}
                  </pre>
                </details>
                <details className="bg-white p-2 rounded border">
                  <summary className="cursor-pointer font-medium">
                    Enrolled Courses
                  </summary>
                  <pre className="text-xs mt-2 overflow-auto max-h-40">
                    {JSON.stringify(enrolledCourses, null, 2)}
                  </pre>
                </details>
                <details className="bg-white p-2 rounded border">
                  <summary className="cursor-pointer font-medium">
                    Local Selected
                  </summary>
                  <pre className="text-xs mt-2 overflow-auto max-h-40">
                    {JSON.stringify(localSelectedCourses, null, 2)}
                  </pre>
                </details>
                <details className="bg-white p-2 rounded border">
                  <summary className="cursor-pointer font-medium">
                    Semester Key Selected
                  </summary>
                  <pre className="text-xs mt-2 overflow-auto max-h-40">
                    {JSON.stringify(localSelectedCoursesSemKey, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          )}

          {showNewState && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">
                Unified State Structure
              </h4>
              <div className="bg-white p-2 rounded border">
                <pre className="text-xs overflow-auto max-h-60">
                  {JSON.stringify(unifiedCourseData, null, 2)}
                </pre>
              </div>
            </div>
          )}
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
