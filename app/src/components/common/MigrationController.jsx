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
export default function MigrationController() {
  const { getMigrationSummary, isMigrationNeeded } = useMigrationManager();

  // Helper function to get semester keys from the unified data structure
  const getSemesterKeys = (data) => {
    if (!data || !data.semesters) return [];
    return Object.keys(data.semesters);
  };

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
  const [summary, setSummary] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showOldState, setShowOldState] = useState(false);
  const [showNewState, setShowNewState] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const [lastDataUpdate, setLastDataUpdate] = useState(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Comprehensive order comparison measures
  const orderComparison = useMemo(() => {
    // Use refreshCounter to force recalculation when needed
    if (refreshCounter !== undefined) {
      console.log("🔄 Order comparison refresh triggered:", refreshCounter);
    }

    if (!filteredCoursesOld) {
      return {
        isReady: false,
        results: {},
        globalState: null,
        reason: "No old filtered courses data",
      };
    }
    if (!unifiedCourseData) {
      return {
        isReady: false,
        results: {},
        globalState: null,
        reason: "No unified course data",
      };
    } // Check if unified system has any actual course data
    // Filter out non-semester properties like selectedSemester, isFutureSemester, etc.
    const semesterKeys = getSemesterKeys(unifiedCourseData);

    const hasUnifiedData = semesterKeys.some(
      (semesterKey) =>
        unifiedCourseData.semesters[semesterKey]?.filtered &&
        unifiedCourseData.semesters[semesterKey].filtered.length > 0
    );

    if (!hasUnifiedData) {
      return {
        isReady: false,
        results: {},
        globalState: {
          selectedSemester: unifiedCourseData.selectedSemester,
          latestValidTerm: unifiedCourseData.latestValidTerm,
        },
        reason: "Unified system exists but has no filtered course data yet",
      };
    }
    const results = {};
    const allSemesters = new Set([
      ...Object.keys(filteredCoursesOld),
      ...semesterKeys,
    ]);

    // Extract global state information
    const globalState = {
      selectedSemester: unifiedCourseData.selectedSemester,
      latestValidTerm: unifiedCourseData.latestValidTerm,
    };
    for (const semester of allSemesters) {
      const oldFiltered = filteredCoursesOld[semester] || [];
      const newFiltered = unifiedCourseData.semesters[semester]?.filtered || [];

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
      globalState,
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
  }, [filteredCoursesOld, unifiedCourseData, refreshCounter]);

  // Dedicated useEffect for monitoring unified course data changes
  useEffect(() => {
    // Monitor unified course data structure changes
    const logUnifiedDataChanges = () => {
      // Get semester keys from the semesters object
      const semesterKeys = getSemesterKeys(unifiedCourseData);

      console.log("🔄 Unified Course Data Updated:", {
        timestamp: new Date().toISOString(),
        hasData: !!unifiedCourseData && !!unifiedCourseData.semesters,
        semesterCount: semesterKeys.length,
        selectedSemester: unifiedCourseData?.selectedSemester,
        latestValidTerm: unifiedCourseData?.latestValidTerm,
        semestersWithFilteredData: semesterKeys
          .filter(
            (sem) => unifiedCourseData.semesters[sem]?.filtered?.length > 0
          )
          .map(
            (sem) =>
              `${sem}(${unifiedCourseData.semesters[sem].filtered.length})`
          ),
      });
    };

    logUnifiedDataChanges(); // Force a refresh of comparison data when unified data structure changes significantly
    const semesterKeys = getSemesterKeys(unifiedCourseData);
    const semesterCount = semesterKeys.length;
    const hasFilteredData = semesterKeys.some(
      (semesterKey) =>
        unifiedCourseData.semesters[semesterKey]?.filtered &&
        unifiedCourseData.semesters[semesterKey].filtered.length > 0
    );

    if (semesterCount > 0 && hasFilteredData) {
      // Increment refresh counter to trigger useMemo recalculation
      setRefreshCounter((prev) => prev + 1);
    }
  }, [unifiedCourseData]);

  // Main useEffect for updating summary and logging
  useEffect(() => {
    // Auto-refresh migration summary whenever state changes
    const newSummary = getMigrationSummary();
    setSummary(newSummary);
    setLastDataUpdate(new Date().toLocaleTimeString());

    // Log unified course data for debugging
    console.log("🚀 Unified Course Data:", unifiedCourseData);
    console.log("📚 Old Course Info:", courseInfo);
    console.log("📝 Old Enrolled Courses:", enrolledCourses);
    console.log("📝 Enrolled Courses Keys:", Object.keys(enrolledCourses));
    console.log("📝 Enrolled Courses Values:", Object.values(enrolledCourses));
    console.log("⭐ Old Local Selected:", localSelectedCourses);
    console.log("🔑 Semester Key Selected:", localSelectedCoursesSemKey);
    console.log("🔍 Filtered Courses (Old):", filteredCoursesOld);
    console.log("⚖️ Order Comparison Results:", orderComparison);
    console.log("⭐ Course Ratings:", shsgCourseRatings);
    //eslint-disable-next-line
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

  if (!summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="p-8 bg-white rounded-lg shadow-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading migration summary...</p>
        </div>
      </div>
    );
  }
  const needsMigration = isMigrationNeeded();

  // Manual refresh function
  const handleManualRefresh = () => {
    setRefreshCounter((prev) => prev + 1);
    setLastDataUpdate(new Date().toLocaleTimeString());
    console.log("🔄 Manual refresh triggered");
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col"
          style={{ height: "calc(100vh - 3rem)" }}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">
                Course Data Migration Manager
              </h2>
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleManualRefresh}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors flex items-center space-x-1"
                  title="Refresh comparison data"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span>Refresh</span>
                </button>
                <div className="text-sm text-gray-500">
                  Last Updated: {lastDataUpdate}
                </div>
                <div className="flex items-center">
                  <span
                    className={`inline-block w-3 h-3 rounded-full mr-2 ${
                      needsMigration ? "bg-yellow-500" : "bg-green-500"
                    }`}
                  ></span>
                  <span className="font-medium text-sm">
                    {needsMigration
                      ? "Migration Available"
                      : "System Up to Date"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 bg-gray-50 px-6 flex-shrink-0">
            <button
              onClick={() => setActiveTab("summary")}
              className={`px-4 py-3 font-medium text-sm transition-colors ${
                activeTab === "summary"
                  ? "border-b-2 border-blue-500 text-blue-600 bg-white"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              Migration Summary
            </button>
            <button
              onClick={() => setActiveTab("order")}
              className={`px-4 py-3 font-medium text-sm transition-colors ${
                activeTab === "order"
                  ? "border-b-2 border-blue-500 text-blue-600 bg-white"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              Order Comparison
            </button>
            <button
              onClick={() => setActiveTab("compare")}
              className={`px-4 py-3 font-medium text-sm transition-colors ${
                activeTab === "compare"
                  ? "border-b-2 border-blue-500 text-blue-600 bg-white"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              State Comparison
            </button>
            <button
              onClick={() => setActiveTab("debug")}
              className={`px-4 py-3 font-medium text-sm transition-colors ${
                activeTab === "debug"
                  ? "border-b-2 border-blue-500 text-blue-600 bg-white"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              Debug Views
            </button>
          </div>

          {/* Tab Content with Proper Scrolling */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto p-6">
              {/* Summary Tab */}
              {activeTab === "summary" && (
                <div className="space-y-6">
                  {needsMigration && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg
                            className="h-5 w-5 text-blue-400 mt-0.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-blue-800">
                            Migration Available
                          </h4>
                          <p className="text-sm text-blue-700 mt-1">
                            Old course data format detected. The system is
                            monitoring both old and unified data structures. Use
                            the tabs above to compare data integrity and order
                            preservation between systems.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-semibold mb-4">
                      Migration Summary
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="font-medium text-gray-700">
                          Course Info Semesters:
                        </span>
                        <div className="text-xl font-bold text-blue-600">
                          {summary.courseInfoSemesters}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="font-medium text-gray-700">
                          Enrolled Courses:
                        </span>
                        <div className="text-xl font-bold text-green-600">
                          {summary.enrolledCoursesSemesters}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="font-medium text-gray-700">
                          Local Selected:
                        </span>
                        <div className="text-xl font-bold text-purple-600">
                          {summary.localSelectedSemesters}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="font-medium text-gray-700">
                          Semester Key Selected:
                        </span>
                        <div className="text-xl font-bold text-orange-600">
                          {summary.semesterKeySelectedSemesters}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="font-medium text-gray-700">
                          Course Ratings:
                        </span>
                        <div className="text-xl font-bold text-red-600">
                          {summary.totalRatings}
                        </div>
                      </div>{" "}
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <span className="font-medium text-gray-700">
                          Unified Semesters:
                        </span>{" "}
                        <div className="text-xl font-bold text-indigo-600">
                          {getSemesterKeys(unifiedCourseData).length}
                        </div>
                      </div>
                    </div>{" "}
                    {/* Global State Information */}
                    {(orderComparison.globalState ||
                      !orderComparison.isReady) && (
                      <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
                        <h4 className="font-semibold text-gray-800 mb-3">
                          Global State Information
                        </h4>

                        {!orderComparison.isReady && orderComparison.reason && (
                          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-sm text-yellow-800">
                              <strong>Status:</strong> {orderComparison.reason}
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Old System State */}
                          <div className="space-y-3">
                            <h5 className="font-medium text-red-700 border-b border-red-200 pb-1">
                              Old System State
                            </h5>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="text-center">
                                <div className="text-lg font-bold text-gray-600">
                                  N/A
                                </div>
                                <div className="text-xs text-gray-500">
                                  Selected Semester
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-gray-600">
                                  N/A
                                </div>
                                <div className="text-xs text-gray-500">
                                  Future Semester
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-gray-600">
                                  Index-based
                                </div>
                                <div className="text-xs text-gray-500">
                                  Reference System
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-gray-600">
                                  Mixed
                                </div>
                                <div className="text-xs text-gray-500">
                                  Data Structure
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* New System State */}
                          <div className="space-y-3">
                            <h5 className="font-medium text-green-700 border-b border-green-200 pb-1">
                              Unified System State
                            </h5>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="text-center">
                                <div className="text-lg font-bold text-blue-600">
                                  {orderComparison.globalState
                                    ?.selectedSemester || "None"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Selected Semester
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-blue-600">
                                  {orderComparison.globalState
                                    ?.latestValidTerm || "None"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Latest Valid Term
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-purple-600">
                                  {
                                    Object.keys(
                                      unifiedCourseData?.semesters || {}
                                    ).length
                                  }
                                </div>
                                <div className="text-xs text-gray-500">
                                  Available Semesters
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg font-bold text-indigo-600">
                                  {orderComparison.globalState
                                    ?.latestValidTerm || "None"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Latest Valid Term
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {orderComparison.isReady && (
                      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                        <h4 className="font-semibold text-gray-800 mb-3">
                          Order Comparison Status
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center">
                            <div
                              className={`text-xl font-bold ${
                                orderComparison.summary.overallStatus ===
                                "perfect"
                                  ? "text-green-600"
                                  : orderComparison.summary.overallStatus ===
                                    "excellent"
                                  ? "text-blue-600"
                                  : orderComparison.summary.overallStatus ===
                                    "good"
                                  ? "text-yellow-600"
                                  : "text-red-600"
                              }`}
                            >
                              {orderComparison.summary.overallStatus.toUpperCase()}
                            </div>
                            <div className="text-sm text-gray-600">
                              Overall Status
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xl font-bold text-green-600">
                              {orderComparison.summary.perfectMatches}/
                              {orderComparison.summary.semesterCount}
                            </div>
                            <div className="text-sm text-gray-600">
                              Perfect Matches
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xl font-bold text-purple-600">
                              {orderComparison.summary.avgPositionAccuracy}%
                            </div>
                            <div className="text-sm text-gray-600">
                              Avg Position Accuracy
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xl font-bold text-orange-600">
                              {orderComparison.summary.avgOrderPreservation}%
                            </div>
                            <div className="text-sm text-gray-600">
                              Avg Order Preservation
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => setShowDetails(!showDetails)}
                      className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                    >
                      {showDetails ? "Hide" : "Show"} Detailed Breakdown
                    </button>
                    {showDetails && summary.detailedCounts && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                        <h4 className="font-semibold mb-3">
                          Per-Semester Course Counts:
                        </h4>
                        <div className="space-y-2">
                          {Object.entries(summary.detailedCounts).map(
                            ([semester, counts]) => (
                              <div
                                key={semester}
                                className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0"
                              >
                                <span className="font-medium text-gray-700">
                                  {semester}:
                                </span>
                                <div className="text-sm text-gray-600">
                                  Available: {counts.available}, Enrolled:{" "}
                                  {counts.enrolled}, Selected:{" "}
                                  {counts.localSelected}
                                  {counts.semesterKeySelected !== undefined &&
                                    `, Semester-keyed: ${counts.semesterKeySelected}`}
                                </div>
                              </div>
                            )
                          )}
                        </div>

                        {summary.semesterMapping && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <span className="font-medium text-gray-700">
                              Semester Mapping:
                            </span>
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                              {Object.entries(summary.semesterMapping).map(
                                ([numKey, shortName]) => (
                                  <div
                                    key={numKey}
                                    className="text-sm bg-white p-2 rounded border"
                                  >
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
                </div>
              )}{" "}
              {/* Order Comparison Tab */}
              {activeTab === "order" && (
                <div>
                  {!orderComparison.isReady ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <svg
                              className="h-5 w-5 text-yellow-400 mt-0.5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h4 className="text-sm font-medium text-yellow-800">
                              Order Comparison Status
                            </h4>
                            <p className="text-sm text-yellow-700 mt-1">
                              {orderComparison.reason}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Show what data is available */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <h4 className="font-medium text-red-800 mb-2">
                            Old System Data
                          </h4>
                          <div className="text-sm space-y-1">
                            <div>
                              Filtered Courses:{" "}
                              {Object.keys(filteredCoursesOld || {}).length}{" "}
                              semesters
                            </div>
                            <div>
                              Sample semesters:{" "}
                              {Object.keys(filteredCoursesOld || {})
                                .slice(0, 3)
                                .join(", ")}
                              {Object.keys(filteredCoursesOld || {}).length >
                                3 && "..."}
                            </div>
                          </div>
                        </div>{" "}
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <h4 className="font-medium text-green-800 mb-2">
                            Unified System Data
                          </h4>
                          <div className="text-sm space-y-1">
                            {" "}
                            <div>
                              Semesters Defined:{" "}
                              {getSemesterKeys(unifiedCourseData).length}
                            </div>
                            <div>
                              Semesters with Filtered Data:{" "}
                              {
                                getSemesterKeys(unifiedCourseData).filter(
                                  (semesterKey) =>
                                    unifiedCourseData.semesters[semesterKey]
                                      ?.filtered &&
                                    unifiedCourseData.semesters[semesterKey]
                                      .filtered.length > 0
                                ).length
                              }
                            </div>
                            {orderComparison.globalState && (
                              <div>
                                Selected:{" "}
                                {orderComparison.globalState.selectedSemester ||
                                  "None"}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Overall Summary */}
                      <div className="bg-gray-50 p-6 rounded-lg border">
                        <h3 className="text-lg font-semibold mb-4">
                          Overall Order Comparison Summary
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {orderComparison.summary.semesterCount}
                            </div>
                            <div className="text-sm text-gray-600">
                              Total Semesters
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {orderComparison.summary.perfectMatches}
                            </div>
                            <div className="text-sm text-gray-600">
                              Perfect Matches
                            </div>
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

                        <div className="mt-4 text-center">
                          <span
                            className={`px-4 py-2 rounded-full text-sm font-semibold ${
                              orderComparison.summary.overallStatus ===
                              "perfect"
                                ? "bg-green-100 text-green-800"
                                : orderComparison.summary.overallStatus ===
                                  "excellent"
                                ? "bg-blue-100 text-blue-800"
                                : orderComparison.summary.overallStatus ===
                                  "good"
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
                              <div
                                key={semester}
                                className="border rounded-lg p-4 bg-white"
                              >
                                <div className="flex justify-between items-center mb-3">
                                  <h4 className="font-semibold text-lg">
                                    {semester}
                                  </h4>
                                  <span
                                    className={`px-3 py-1 rounded text-sm font-medium ${
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
                                      {Math.min(
                                        result.oldCount,
                                        result.newCount
                                      )}
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
                                      <details className="bg-yellow-50 p-3 rounded border">
                                        <summary className="cursor-pointer font-medium text-yellow-800">
                                          {result.misplacedCourses.length}{" "}
                                          Misplaced Courses
                                        </summary>
                                        <div className="mt-2 text-sm space-y-1">
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
                                                (displaced by{" "}
                                                {course.displacement})
                                              </div>
                                            ))}
                                          {result.misplacedCourses.length >
                                            5 && (
                                            <div className="text-yellow-600 text-xs">
                                              ... and{" "}
                                              {result.misplacedCourses.length -
                                                5}{" "}
                                              more
                                            </div>
                                          )}
                                        </div>
                                      </details>
                                    )}

                                    {result.onlyInOld.length > 0 && (
                                      <details className="bg-red-50 p-3 rounded border">
                                        <summary className="cursor-pointer font-medium text-red-800">
                                          {result.onlyInOld.length} Courses Only
                                          in Old System
                                        </summary>
                                        <div className="mt-2 text-sm text-red-700">
                                          {result.onlyInOld
                                            .slice(0, 5)
                                            .join(", ")}
                                          {result.onlyInOld.length > 5 &&
                                            ` ... and ${
                                              result.onlyInOld.length - 5
                                            } more`}
                                        </div>
                                      </details>
                                    )}

                                    {result.onlyInNew.length > 0 && (
                                      <details className="bg-blue-50 p-3 rounded border">
                                        <summary className="cursor-pointer font-medium text-blue-800">
                                          {result.onlyInNew.length} Courses Only
                                          in New System
                                        </summary>
                                        <div className="mt-2 text-sm text-blue-700">
                                          {result.onlyInNew
                                            .slice(0, 5)
                                            .join(", ")}
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
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h4 className="font-semibold text-blue-800 mb-2">
                          Metric Explanations
                        </h4>
                        <div className="text-sm text-blue-700 space-y-1">
                          <div>
                            <strong>Position Accuracy:</strong> Percentage of
                            courses that appear in the same position in both
                            systems
                          </div>
                          <div>
                            <strong>Order Preservation:</strong> Kendall&apos;s
                            tau-like metric measuring how well the relative
                            order is preserved
                          </div>
                          <div>
                            <strong>Same Elements:</strong> Whether both systems
                            have exactly the same set of courses (regardless of
                            order)
                          </div>
                          <div>
                            <strong>Status Levels:</strong> Perfect (100% match)
                            → Excellent (90%+ accuracy) → Good (70%+) → Fair
                            (50%+) → Poor (&lt;50%)
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
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <h3 className="text-lg font-semibold mb-4 text-red-800">
                      Old State Management
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-red-700 mb-2">
                          Course Info (by index)
                        </h4>
                        <div className="text-sm bg-white p-3 rounded border max-h-40 overflow-y-auto">
                          {Object.keys(courseInfo).length > 0 ? (
                            Object.entries(courseInfo).map(
                              ([index, courses]) => (
                                <div
                                  key={index}
                                  className="flex justify-between py-1 border-b border-gray-100 last:border-b-0"
                                >
                                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                    [{index}]
                                  </span>
                                  <span>{courses?.length || 0} courses</span>
                                </div>
                              )
                            )
                          ) : (
                            <span className="text-gray-500">No data</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-red-700 mb-2">
                          Enrolled Courses (by index)
                        </h4>
                        <div className="text-sm bg-white p-3 rounded border max-h-40 overflow-y-auto">
                          {Object.keys(enrolledCourses).length > 0 ? (
                            Object.entries(enrolledCourses).map(
                              ([index, courses]) => (
                                <div
                                  key={index}
                                  className="flex justify-between py-1 border-b border-gray-100 last:border-b-0"
                                >
                                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                    [{index}]
                                  </span>
                                  <span>{courses?.length || 0} courses</span>
                                </div>
                              )
                            )
                          ) : (
                            <span className="text-gray-500">No data</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-red-700 mb-2">
                          Local Selected (by index)
                        </h4>
                        <div className="text-sm bg-white p-3 rounded border max-h-40 overflow-y-auto">
                          {Object.keys(localSelectedCourses).length > 0 ? (
                            Object.entries(localSelectedCourses).map(
                              ([index, courses]) => (
                                <div
                                  key={index}
                                  className="flex justify-between py-1 border-b border-gray-100 last:border-b-0"
                                >
                                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                    [{index}]
                                  </span>
                                  <span>{courses?.length || 0} courses</span>
                                </div>
                              )
                            )
                          ) : (
                            <span className="text-gray-500">No data</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-red-700 mb-2">
                          Semester Key Selected
                        </h4>
                        <div className="text-sm bg-white p-3 rounded border max-h-40 overflow-y-auto">
                          {Object.keys(localSelectedCoursesSemKey).length >
                          0 ? (
                            Object.entries(localSelectedCoursesSemKey).map(
                              ([semKey, courses]) => (
                                <div
                                  key={semKey}
                                  className="flex justify-between py-1 border-b border-gray-100 last:border-b-0"
                                >
                                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                    {semKey}
                                  </span>
                                  <span>{courses?.length || 0} courses</span>
                                </div>
                              )
                            )
                          ) : (
                            <span className="text-gray-500">No data</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-red-700 mb-2">
                          Filtered Courses (Old Selector)
                        </h4>
                        <div className="text-sm bg-white p-3 rounded border max-h-40 overflow-y-auto">
                          {Object.keys(filteredCoursesOld).length > 0 ? (
                            Object.entries(filteredCoursesOld).map(
                              ([semester, courses]) => (
                                <div
                                  key={semester}
                                  className="flex justify-between py-1 border-b border-gray-100 last:border-b-0"
                                >
                                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                    {semester}
                                  </span>
                                  <span>
                                    {courses?.length || 0} filtered courses
                                  </span>
                                </div>
                              )
                            )
                          ) : (
                            <span className="text-gray-500">No data</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>{" "}
                  {/* New State Column */}
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h3 className="text-lg font-semibold mb-4 text-green-800">
                      Unified State Management
                    </h3>

                    {/* Full Unified State Display */}
                    <div className="space-y-4">
                      {/* Global State Section */}
                      <div>
                        <h4 className="font-medium text-green-700 mb-2">
                          Global State
                        </h4>
                        <div className="text-sm bg-white p-3 rounded border">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              Selected Semester:{" "}
                              <span className="font-semibold text-blue-600">
                                {unifiedCourseData?.selectedSemester || "None"}
                              </span>
                            </div>
                            <div>
                              Selected Semester:{" "}
                              <span className="font-semibold text-blue-600">
                                {unifiedCourseData?.selectedSemester || "None"}
                              </span>
                            </div>
                            <div>
                              Available Semesters:{" "}
                              <span className="font-semibold text-green-600">
                                {
                                  Object.keys(
                                    unifiedCourseData?.semesters || {}
                                  ).length
                                }
                              </span>
                            </div>
                            <div>
                              Latest Valid Term:{" "}
                              <span className="font-semibold text-indigo-600">
                                {unifiedCourseData?.latestValidTerm || "None"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>{" "}
                      {/* Semester Data Section */}
                      <div>
                        {" "}
                        <h4 className="font-medium text-green-700 mb-2">
                          Semester Data (
                          {getSemesterKeys(unifiedCourseData).length} semesters)
                        </h4>
                        <div className="text-sm bg-white p-3 rounded border max-h-96 overflow-y-auto">
                          {getSemesterKeys(unifiedCourseData).length > 0 ? (
                            getSemesterKeys(unifiedCourseData).map(
                              (semester) => {
                                const data =
                                  unifiedCourseData.semesters[semester];
                                return (
                                  <div
                                    key={semester}
                                    className="mb-3 p-3 border border-gray-200 rounded"
                                  >
                                    <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded mb-2 inline-block">
                                      {semester}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div>
                                        Available:{" "}
                                        <span className="font-semibold">
                                          {data?.available?.length || 0}
                                        </span>
                                      </div>
                                      <div>
                                        Enrolled:{" "}
                                        <span className="font-semibold">
                                          {data?.enrolled?.length || 0}
                                        </span>
                                      </div>
                                      <div>
                                        Selected:{" "}
                                        <span className="font-semibold">
                                          {data?.selected?.length || 0}
                                        </span>
                                      </div>
                                      <div>
                                        Filtered:{" "}
                                        <span className="font-semibold">
                                          {data?.filtered?.length || 0}
                                        </span>
                                      </div>
                                      <div className="col-span-2">
                                        Ratings:{" "}
                                        <span className="font-semibold">
                                          {
                                            Object.keys(data?.ratings || {})
                                              .length
                                          }
                                        </span>
                                      </div>
                                      <div className="col-span-2 text-gray-500">
                                        Last Fetched:{" "}
                                        {data?.lastFetched
                                          ? new Date(
                                              data.lastFetched
                                            ).toLocaleString()
                                          : "Never"}
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                            )
                          ) : (
                            <span className="text-gray-500">
                              No semester data available
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Raw JSON View */}
                      <div>
                        <details className="bg-white p-2 rounded border">
                          <summary className="cursor-pointer font-medium text-green-700">
                            Full Unified State JSON
                          </summary>
                          <pre className="text-xs mt-2 overflow-auto max-h-60 bg-gray-50 p-2 rounded">
                            {JSON.stringify(unifiedCourseData, null, 2)}
                          </pre>{" "}
                        </details>
                      </div>
                    </div>
                  </div>
                </div>
              )}{" "}
              {/* Debug Tab */}
              {activeTab === "debug" && (
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={() => setShowOldState(!showOldState)}
                      className="px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
                    >
                      {showOldState ? "Hide" : "Show"} Old State JSON
                    </button>
                    <button
                      onClick={() => setShowNewState(!showNewState)}
                      className="px-4 py-2 bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors"
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
                          filteredCoursesOld,
                          orderComparison,
                        })
                      }
                      className="px-4 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
                    >
                      Log All States to Console
                    </button>
                  </div>

                  {showOldState && (
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <h4 className="font-medium text-red-800 mb-3">
                        Old State Structure
                      </h4>
                      <div className="space-y-3">
                        <details className="bg-white p-3 rounded border">
                          <summary className="cursor-pointer font-medium">
                            Course Info
                          </summary>
                          <pre className="text-xs mt-2 overflow-auto max-h-40 bg-gray-50 p-2 rounded">
                            {JSON.stringify(courseInfo, null, 2)}
                          </pre>
                        </details>
                        <details className="bg-white p-3 rounded border">
                          <summary className="cursor-pointer font-medium">
                            Enrolled Courses
                          </summary>
                          <pre className="text-xs mt-2 overflow-auto max-h-40 bg-gray-50 p-2 rounded">
                            {JSON.stringify(enrolledCourses, null, 2)}
                          </pre>
                        </details>
                        <details className="bg-white p-3 rounded border">
                          <summary className="cursor-pointer font-medium">
                            Local Selected
                          </summary>
                          <pre className="text-xs mt-2 overflow-auto max-h-40 bg-gray-50 p-2 rounded">
                            {JSON.stringify(localSelectedCourses, null, 2)}
                          </pre>
                        </details>
                        <details className="bg-white p-3 rounded border">
                          <summary className="cursor-pointer font-medium">
                            Semester Key Selected
                          </summary>
                          <pre className="text-xs mt-2 overflow-auto max-h-40 bg-gray-50 p-2 rounded">
                            {JSON.stringify(
                              localSelectedCoursesSemKey,
                              null,
                              2
                            )}
                          </pre>
                        </details>
                        <details className="bg-white p-3 rounded border">
                          <summary className="cursor-pointer font-medium">
                            Filtered Courses (Old Selector)
                          </summary>
                          <pre className="text-xs mt-2 overflow-auto max-h-40 bg-gray-50 p-2 rounded">
                            {JSON.stringify(filteredCoursesOld, null, 2)}
                          </pre>
                        </details>
                      </div>
                    </div>
                  )}

                  {showNewState && (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <h4 className="font-medium text-green-800 mb-3">
                        Unified State Structure
                      </h4>
                      <div className="bg-white p-3 rounded border">
                        <pre className="text-xs overflow-auto max-h-60 bg-gray-50 p-2 rounded">
                          {JSON.stringify(unifiedCourseData, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Footer */}
              <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-500">
                  This migration controller can be removed once the transition
                  is complete and all components are using the unified system.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { MigrationController };
