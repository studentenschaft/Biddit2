import React, { useState, useEffect } from "react";
import { useRecoilValue } from "recoil";
import { useUnifiedCourseData } from "../helpers/useUnifiedCourseData";
import { selectedSemesterAtom } from "../recoil/selectedSemesterAtom";
import { selectionOptionsState } from "../recoil/selectionOptionsAtom";
import { selectedCourseIdsAtom } from "../recoil/selectedCourseIdsAtom";

/**
 * Demo component showing how to use the new filtered courses functionality
 * This demonstrates the unified course data system with filtered courses
 */
export function FilteredCoursesDemo() {
  const selectedSemester = useRecoilValue(selectedSemesterAtom);
  const selectionOptions = useRecoilValue(selectionOptionsState);
  const selectedCourseIds = useRecoilValue(selectedCourseIdsAtom);

  const {
    courseData,
    updateFilteredCourses,
    updateFilteredCoursesForAllSemesters,
    getSemesterData,
  } = useUnifiedCourseData();

  const [demoFilterOptions, setDemoFilterOptions] = useState({
    classifications: ["Elective"],
    ects: [600], // 6 ECTS courses
    searchTerm: "",
    ratings: [],
    courseLanguage: [],
    lecturer: [],
  });

  // Demo function to apply filters to current semester
  const applyFilterToCurrentSemester = () => {
    if (selectedSemester?.shortName) {
      updateFilteredCourses(selectedSemester.shortName, demoFilterOptions);
    }
  };

  // Demo function to apply filters to all semesters
  const applyFilterToAllSemesters = () => {
    updateFilteredCoursesForAllSemesters(demoFilterOptions);
  };

  // Demo function to use real selection options
  const applyRealFilters = () => {
    if (selectedSemester?.shortName) {
      updateFilteredCourses(selectedSemester.shortName, selectionOptions);
    }
  };

  const currentSemesterData = selectedSemester?.shortName
    ? getSemesterData(selectedSemester.shortName)
    : null;

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-4xl mx-auto my-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        Filtered Courses Demo - Unified System
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700">
            Filter Controls
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Current Semester: {selectedSemester?.shortName || "None selected"}
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Demo Filter - Search Term:
            </label>
            <input
              type="text"
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="Enter course name..."
              value={demoFilterOptions.searchTerm}
              onChange={(e) =>
                setDemoFilterOptions((prev) => ({
                  ...prev,
                  searchTerm: e.target.value,
                }))
              }
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={applyFilterToCurrentSemester}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={!selectedSemester}
            >
              Apply Demo Filter to Current Semester
            </button>

            <button
              onClick={applyFilterToAllSemesters}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Apply Demo Filter to All Semesters
            </button>

            <button
              onClick={applyRealFilters}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              disabled={!selectedSemester}
            >
              Apply Real Selection Options
            </button>
          </div>

          <div className="text-sm text-gray-600">
            <p>
              <strong>Demo Filter Settings:</strong>
            </p>
            <ul className="list-disc list-inside">
              <li>
                Classifications:{" "}
                {demoFilterOptions.classifications.join(", ") || "None"}
              </li>
              <li>
                ECTS:{" "}
                {demoFilterOptions.ects.map((e) => e / 100).join(", ") ||
                  "None"}
              </li>
              <li>
                Search Term: "{demoFilterOptions.searchTerm}"{" "}
                {!demoFilterOptions.searchTerm && "(empty)"}
              </li>
            </ul>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700">
            Filter Results
          </h3>

          {currentSemesterData ? (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded">
                <h4 className="font-medium text-gray-700">
                  Current Semester ({selectedSemester.shortName})
                </h4>
                <div className="text-sm text-gray-600 mt-1">
                  <div>
                    Available Courses:{" "}
                    {currentSemesterData.available?.length || 0}
                  </div>
                  <div>
                    Filtered Courses:{" "}
                    {currentSemesterData.filtered?.length || 0}
                  </div>
                  <div>
                    Enrolled Courses:{" "}
                    {currentSemesterData.enrolled?.length || 0}
                  </div>
                  <div>
                    Selected Courses:{" "}
                    {currentSemesterData.selected?.length || 0}
                  </div>
                </div>
              </div>

              {currentSemesterData.filtered &&
                currentSemesterData.filtered.length > 0 && (
                  <div className="p-3 bg-blue-50 rounded">
                    <h4 className="font-medium text-blue-700">
                      Filtered Courses ({currentSemesterData.filtered.length})
                    </h4>
                    <div className="max-h-48 overflow-y-auto mt-2">
                      {currentSemesterData.filtered
                        .slice(0, 10)
                        .map((course, index) => (
                          <div
                            key={course.id || index}
                            className="text-sm text-blue-600 py-1"
                          >
                            {course.shortName} - {course.classification} (
                            {course.credits / 100} ECTS)
                          </div>
                        ))}
                      {currentSemesterData.filtered.length > 10 && (
                        <div className="text-sm text-blue-500 italic">
                          ... and {currentSemesterData.filtered.length - 10}{" "}
                          more courses
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>
          ) : (
            <div className="p-3 bg-yellow-50 rounded text-yellow-700">
              Please select a semester to see filter results
            </div>
          )}

          {/* All Semesters Summary */}
          <div className="p-3 bg-green-50 rounded">
            <h4 className="font-medium text-green-700">
              All Semesters Summary
            </h4>
            <div className="text-sm text-green-600 mt-1">
              {Object.entries(courseData).map(([semester, data]) => (
                <div key={semester}>
                  {semester}: {data.filtered?.length || 0} filtered /{" "}
                  {data.available?.length || 0} available
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-100 rounded">
        <h4 className="font-medium text-gray-700 mb-2">
          How to Use Filtered Courses:
        </h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p>
            <code>updateFilteredCourses(semesterName, filterOptions)</code> -
            Filter courses for a specific semester
          </p>
          <p>
            <code>updateFilteredCoursesForAllSemesters(filterOptions)</code> -
            Filter courses for all semesters
          </p>
          <p>
            <code>getSemesterData(semesterName).filtered</code> - Access
            filtered courses array
          </p>
          <p>
            Filter options include: classifications, ects, ratings,
            courseLanguage, lecturer, searchTerm
          </p>
        </div>
      </div>
    </div>
  );
}

export default FilteredCoursesDemo;
