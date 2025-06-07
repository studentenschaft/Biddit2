import { useState, useEffect, useMemo } from "react";
import { useRecoilValue } from "recoil";
import { useMigrationManager } from "../helpers/useMigrationManager";
import { unifiedCourseDataState } from "../recoil/unifiedCourseDataAtom";
import { courseInfoState } from "../recoil/courseInfoAtom";
import { enrolledCoursesState } from "../recoil/enrolledCoursesAtom";
import { localSelectedCoursesState } from "../recoil/localSelectedCoursesAtom";
import { localSelectedCoursesSemKeyState } from "../recoil/localSelectedCoursesSemKeyAtom";
import { shsgCourseRatingsState } from "../recoil/shsgCourseRatingsAtom";
import { filteredCoursesSelector } from "../recoil/filteredCoursesSelector";

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
  const filteredCoursesOld = useRecoilValue(filteredCoursesSelector);

  const [migrationStatus, setMigrationStatus] = useState("idle"); // idle, running, success, error
  const [summary, setSummary] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showOldState, setShowOldState] = useState(false);
  const [showNewState, setShowNewState] = useState(false);
  const [activeTab, setActiveTab] = useState("summary"); // summary, compare, debug

  // Comprehensive order comparison measures
  const orderComparison = useMemo(() => {
    if (!filteredCoursesOld || !unifiedCourseData) {
      return { isReady: false, results: {} };
    }

    const results = {};
    const allSemesters = new Set([
      ...Object.keys(filteredCoursesOld),
      ...Object.keys(unifiedCourseData),
    ]);

    for (const semester of allSemesters) {
      const oldFiltered = filteredCoursesOld[semester] || [];
      const newFiltered = unifiedCourseData[semester]?.filtered || [];

      // Basic counts
      const oldCount = oldFiltered.length;
      const newCount = newFiltered.length;

      // Extract course identifiers for comparison
      const oldCourseIds = oldFiltered.map(
        (course) => course.course_id || course.id
      );
      const newCourseIds = newFiltered.map(
        (course) => course.course_id || course.id
      );

      // Order comparison metrics
      const exactMatch =
        JSON.stringify(oldCourseIds) === JSON.stringify(newCourseIds);
      const sameLength = oldCount === newCount;
      const sameElements =
        new Set(oldCourseIds).size ===
        new Set([...oldCourseIds, ...newCourseIds]).size;

      // Position-based comparison
      let positionMatches = 0;
      let maxComparableLength = Math.min(oldCount, newCount);
      for (let i = 0; i < maxComparableLength; i++) {
        if (oldCourseIds[i] === newCourseIds[i]) {
          positionMatches++;
        }
      }

      // Calculate order similarity metrics
      const positionAccuracy =
        maxComparableLength > 0
          ? (positionMatches / maxComparableLength) * 100
          : 0;

      // Find misplaced courses
      const misplacedCourses = [];
      oldCourseIds.forEach((courseId, oldIndex) => {
        const newIndex = newCourseIds.indexOf(courseId);
        if (newIndex !== -1 && newIndex !== oldIndex) {
          misplacedCourses.push({
            courseId,
            oldPosition: oldIndex,
            newPosition: newIndex,
            displacement: Math.abs(newIndex - oldIndex),
          });
        }
      });

      // Courses only in old or new
      const onlyInOld = oldCourseIds.filter((id) => !newCourseIds.includes(id));
      const onlyInNew = newCourseIds.filter((id) => !oldCourseIds.includes(id));

      // Order preservation score (Kendall's tau-like metric)
      let concordantPairs = 0;
      let discordantPairs = 0;
      let totalPairs = 0;

      for (let i = 0; i < oldCourseIds.length; i++) {
        for (let j = i + 1; j < oldCourseIds.length; j++) {
          const course1 = oldCourseIds[i];
          const course2 = oldCourseIds[j];
          const newPos1 = newCourseIds.indexOf(course1);
          const newPos2 = newCourseIds.indexOf(course2);

          if (newPos1 !== -1 && newPos2 !== -1) {
            totalPairs++;
            if (newPos1 < newPos2) {
              concordantPairs++;
            } else {
              discordantPairs++;
            }
          }
        }
      }

      const orderPreservationScore =
        totalPairs > 0
          ? ((concordantPairs - discordantPairs) / totalPairs) * 100
          : 0;

      results[semester] = {
        oldCount,
        newCount,
        exactMatch,
        sameLength,
        sameElements,
        positionMatches,
        positionAccuracy: Math.round(positionAccuracy * 100) / 100,
        misplacedCourses,
        onlyInOld,
        onlyInNew,
        orderPreservationScore: Math.round(orderPreservationScore * 100) / 100,
        status: exactMatch
          ? "perfect"
          : sameElements && positionAccuracy > 90
          ? "excellent"
          : sameElements && positionAccuracy > 70
          ? "good"
          : sameElements && positionAccuracy > 50
          ? "fair"
          : "poor",
      };
    }

    // Overall statistics
    const semesterCount = Object.keys(results).length;
    const perfectMatches = Object.values(results).filter(
      (r) => r.exactMatch
    ).length;
    const sameElementsCount = Object.values(results).filter(
      (r) => r.sameElements
    ).length;
    const avgPositionAccuracy =
      semesterCount > 0
        ? Object.values(results).reduce(
            (sum, r) => sum + r.positionAccuracy,
            0
          ) / semesterCount
        : 0;
    const avgOrderPreservation =
      semesterCount > 0
        ? Object.values(results).reduce(
            (sum, r) => sum + r.orderPreservationScore,
            0
          ) / semesterCount
        : 0;

    return {
      isReady: true,
      results,
      summary: {
        semesterCount,
        perfectMatches,
        sameElementsCount,
        avgPositionAccuracy: Math.round(avgPositionAccuracy * 100) / 100,
        avgOrderPreservation: Math.round(avgOrderPreservation * 100) / 100,
        overallStatus:
          perfectMatches === semesterCount
            ? "perfect"
            : perfectMatches / semesterCount > 0.8
            ? "excellent"
            : sameElementsCount / semesterCount > 0.8
            ? "good"
            : "needs_attention",
      },
    };
  }, [filteredCoursesOld, unifiedCourseData]);

  useEffect(() => {
    // Get migration summary on component mount
    setSummary(getMigrationSummary()); // Log unified course data for debugging
    console.log("🚀 Unified Course Data:", unifiedCourseData);
    console.log("📚 Old Course Info:", courseInfo);
    console.log("📝 Old Enrolled Courses:", enrolledCourses);
    console.log("📝 Enrolled Courses Keys:", Object.keys(enrolledCourses));
    console.log("📝 Enrolled Courses Values:", Object.values(enrolledCourses));
    console.log("⭐ Old Local Selected:", localSelectedCourses);
    console.log("🔑 Semester Key Selected:", localSelectedCoursesSemKey);
    console.log("🔍 Filtered Courses (Old):", filteredCoursesOld);
    console.log("⚖️ Order Comparison Results:", orderComparison);
    console.log("⭐ Course Ratings:", shsgCourseRatings); //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    unifiedCourseData,
    courseInfo,
    enrolledCourses,
    localSelectedCourses,
    localSelectedCoursesSemKey,
    shsgCourseRatings,
    filteredCoursesOld,
    orderComparison,
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
      </h2>{" "}
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
          onClick={() => setActiveTab("order")}
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === "order"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Order Comparison
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
              </div>{" "}
              <div>
                <span className="font-medium">Semester Key Selected:</span>{" "}
                {summary.semesterKeySelectedSemesters}
              </div>
              <div>
                <span className="font-medium">Course Ratings:</span>{" "}
                {summary.totalRatings}
              </div>
              <div>
                <span className="font-medium">Filtered Courses (Old):</span>{" "}
                {Object.keys(filteredCoursesOld).length} semesters
              </div>{" "}
              <div>
                <span className="font-medium">Unified Semesters:</span>{" "}
                {Object.keys(unifiedCourseData).length}
              </div>
              {orderComparison.isReady && (
                <>
                  <div>
                    <span className="font-medium">
                      Order Comparison Status:
                    </span>{" "}
                    <span
                      className={`font-semibold ${
                        orderComparison.summary.overallStatus === "perfect"
                          ? "text-green-600"
                          : orderComparison.summary.overallStatus ===
                            "excellent"
                          ? "text-blue-600"
                          : orderComparison.summary.overallStatus === "good"
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    >
                      {orderComparison.summary.overallStatus.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Perfect Order Matches:</span>{" "}
                    {orderComparison.summary.perfectMatches}/
                    {orderComparison.summary.semesterCount}
                  </div>
                </>
              )}
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
          )}{" "}
        </div>
      )}
      {/* Order Comparison Tab */}
      {activeTab === "order" && (
        <div>
          {!orderComparison.isReady ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800">
                Order comparison requires both old filtered courses and unified
                course data. Please ensure both systems have filtered course
                data.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overall Summary */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">
                  Overall Order Comparison Summary
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {orderComparison.summary.semesterCount}
                    </div>
                    <div className="text-sm text-gray-600">Total Semesters</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {orderComparison.summary.perfectMatches}
                    </div>
                    <div className="text-sm text-gray-600">Perfect Matches</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {orderComparison.summary.avgPositionAccuracy}%
                    </div>
                    <div className="text-sm text-gray-600">
                      Avg Position Accuracy
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {orderComparison.summary.avgOrderPreservation}%
                    </div>
                    <div className="text-sm text-gray-600">
                      Avg Order Preservation
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg text-center font-semibold">
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      orderComparison.summary.overallStatus === "perfect"
                        ? "bg-green-100 text-green-800"
                        : orderComparison.summary.overallStatus === "excellent"
                        ? "bg-blue-100 text-blue-800"
                        : orderComparison.summary.overallStatus === "good"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    Overall Status:{" "}
                    {orderComparison.summary.overallStatus.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Per-Semester Detailed Comparison */}
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Per-Semester Order Analysis
                </h3>
                <div className="space-y-4">
                  {Object.entries(orderComparison.results).map(
                    ([semester, result]) => (
                      <div key={semester} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold text-lg">{semester}</h4>
                          <span
                            className={`px-2 py-1 rounded text-sm font-medium ${
                              result.status === "perfect"
                                ? "bg-green-100 text-green-800"
                                : result.status === "excellent"
                                ? "bg-blue-100 text-blue-800"
                                : result.status === "good"
                                ? "bg-yellow-100 text-yellow-800"
                                : result.status === "fair"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {result.status.toUpperCase()}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className="text-center">
                            <div className="text-xl font-bold text-gray-700">
                              {result.oldCount} → {result.newCount}
                            </div>
                            <div className="text-sm text-gray-600">
                              Course Count
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xl font-bold text-green-600">
                              {result.positionMatches}/
                              {Math.min(result.oldCount, result.newCount)}
                            </div>
                            <div className="text-sm text-gray-600">
                              Position Matches
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xl font-bold text-blue-600">
                              {result.positionAccuracy}%
                            </div>
                            <div className="text-sm text-gray-600">
                              Position Accuracy
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xl font-bold text-purple-600">
                              {result.orderPreservationScore}%
                            </div>
                            <div className="text-sm text-gray-600">
                              Order Preservation
                            </div>
                          </div>
                        </div>

                        {/* Status indicators */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {result.exactMatch && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                              ✓ Exact Match
                            </span>
                          )}
                          {result.sameLength && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              ✓ Same Length
                            </span>
                          )}
                          {result.sameElements && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                              ✓ Same Elements
                            </span>
                          )}
                        </div>

                        {/* Issues */}
                        {(result.misplacedCourses.length > 0 ||
                          result.onlyInOld.length > 0 ||
                          result.onlyInNew.length > 0) && (
                          <div className="space-y-2">
                            {result.misplacedCourses.length > 0 && (
                              <details className="bg-yellow-50 p-2 rounded">
                                <summary className="cursor-pointer font-medium text-yellow-800">
                                  {result.misplacedCourses.length} Misplaced
                                  Courses
                                </summary>
                                <div className="mt-2 text-sm">
                                  {result.misplacedCourses
                                    .slice(0, 5)
                                    .map((course, idx) => (
                                      <div
                                        key={idx}
                                        className="text-yellow-700"
                                      >
                                        {course.courseId}: pos{" "}
                                        {course.oldPosition} →{" "}
                                        {course.newPosition}
                                        (displaced by {course.displacement})
                                      </div>
                                    ))}
                                  {result.misplacedCourses.length > 5 && (
                                    <div className="text-yellow-600 text-xs">
                                      ... and{" "}
                                      {result.misplacedCourses.length - 5} more
                                    </div>
                                  )}
                                </div>
                              </details>
                            )}

                            {result.onlyInOld.length > 0 && (
                              <details className="bg-red-50 p-2 rounded">
                                <summary className="cursor-pointer font-medium text-red-800">
                                  {result.onlyInOld.length} Courses Only in Old
                                  System
                                </summary>
                                <div className="mt-2 text-sm text-red-700">
                                  {result.onlyInOld.slice(0, 5).join(", ")}
                                  {result.onlyInOld.length > 5 &&
                                    ` ... and ${
                                      result.onlyInOld.length - 5
                                    } more`}
                                </div>
                              </details>
                            )}

                            {result.onlyInNew.length > 0 && (
                              <details className="bg-blue-50 p-2 rounded">
                                <summary className="cursor-pointer font-medium text-blue-800">
                                  {result.onlyInNew.length} Courses Only in New
                                  System
                                </summary>
                                <div className="mt-2 text-sm text-blue-700">
                                  {result.onlyInNew.slice(0, 5).join(", ")}
                                  {result.onlyInNew.length > 5 &&
                                    ` ... and ${
                                      result.onlyInNew.length - 5
                                    } more`}
                                </div>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Explanation of Metrics */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">
                  Metric Explanations
                </h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <div>
                    <strong>Position Accuracy:</strong> Percentage of courses
                    that appear in the same position in both systems
                  </div>
                  <div>
                    <strong>Order Preservation:</strong> Kendall&apos;s tau-like
                    metric measuring how well the relative order is preserved
                  </div>
                  <div>
                    <strong>Same Elements:</strong> Whether both systems have
                    exactly the same set of courses (regardless of order)
                  </div>
                  <div>
                    <strong>Status Levels:</strong> Perfect (100% match) →
                    Excellent (90%+ accuracy) → Good (70%+) → Fair (50%+) → Poor
                    (&lt;50%)
                  </div>
                </div>
              </div>
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
              </div>{" "}
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
              <div>
                <h4 className="font-medium text-red-700">
                  Filtered Courses (Old Selector)
                </h4>
                <div className="text-sm bg-white p-2 rounded border">
                  {Object.keys(filteredCoursesOld).length > 0 ? (
                    Object.entries(filteredCoursesOld).map(
                      ([semester, courses]) => (
                        <div key={semester} className="mb-1">
                          <span className="font-mono text-xs bg-gray-100 px-1 rounded">
                            {semester}
                          </span>
                          : {courses?.length || 0} filtered courses
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
                          </div>{" "}
                          <div className="ml-2 text-xs">
                            <div>Available: {data.available?.length || 0}</div>
                            <div>Enrolled: {data.enrolled?.length || 0}</div>
                            <div>Selected: {data.selected?.length || 0}</div>
                            <div>Filtered: {data.filtered?.length || 0}</div>
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
            </button>{" "}
            <button
              onClick={() =>
                console.log("🚀 Full State Dump:", {
                  unifiedCourseData,
                  courseInfo,
                  enrolledCourses,
                  localSelectedCourses,
                  localSelectedCoursesSemKey,
                  shsgCourseRatings,
                  filteredCoursesOld,
                  orderComparison,
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
                </details>{" "}
                <details className="bg-white p-2 rounded border">
                  <summary className="cursor-pointer font-medium">
                    Semester Key Selected
                  </summary>
                  <pre className="text-xs mt-2 overflow-auto max-h-40">
                    {JSON.stringify(localSelectedCoursesSemKey, null, 2)}
                  </pre>
                </details>
                <details className="bg-white p-2 rounded border">
                  <summary className="cursor-pointer font-medium">
                    Filtered Courses (Old Selector)
                  </summary>
                  <pre className="text-xs mt-2 overflow-auto max-h-40">
                    {JSON.stringify(filteredCoursesOld, null, 2)}
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
