/**
 * UnifiedDataInspector - Debug component to inspect unified course data structure
 * 
 * This component helps validate what data is available in the unified course data atom
 * and understand the actual structure vs expected structure for conversion planning.
 */

import React, { useState } from 'react';
import { useRecoilValue } from 'recoil';
import { unifiedCourseDataState } from '../recoil/unifiedCourseDataAtom';
import { allSemesterCoursesSelector, semesterCoursesSelector } from '../recoil/unifiedCourseDataSelectors';

const UnifiedDataInspector = () => {
  const [expanded, setExpanded] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState('');
  const unifiedData = useRecoilValue(unifiedCourseDataState);
  const allSemesters = useRecoilValue(allSemesterCoursesSelector);

  // Test semesterCoursesSelector if a semester is selected
  let selectedCoursesData = null;
  let availableCoursesData = null;
  if (selectedSemester) {
    try {
      selectedCoursesData = useRecoilValue(semesterCoursesSelector({
        semester: selectedSemester,
        type: 'selected'
      }));
      availableCoursesData = useRecoilValue(semesterCoursesSelector({
        semester: selectedSemester,
        type: 'available'
      }));
    } catch (error) {
      console.error('Error testing semesterCoursesSelector:', error);
    }
  }

  const getSummaryStats = () => {
    const stats = {
      totalSemesters: Object.keys(unifiedData.semesters || {}).length,
      semesterDetails: {},
      globalInfo: {
        selectedSemester: unifiedData.selectedSemester,
        latestValidTerm: unifiedData.latestValidTerm
      }
    };

    Object.entries(unifiedData.semesters || {}).forEach(([semester, data]) => {
      stats.semesterDetails[semester] = {
        enrolledIds: data.enrolledIds?.length || 0,
        availableCount: data.available?.length || 0,
        selectedIds: data.selectedIds?.length || 0,
        filteredCount: data.filtered?.length || 0,
        studyPlanCount: data.studyPlan?.length || 0,
        ratingsCount: Object.keys(data.ratings || {}).length,
        metadata: {
          isCurrent: data.isCurrent,
          isProjected: data.isProjected,
          isFutureSemester: data.isFutureSemester,
          cisId: data.cisId,
          lastFetched: data.lastFetched
        }
      };
    });

    return stats;
  };

  const stats = getSummaryStats();
  const availableSemesters = Object.keys(unifiedData.semesters || {});

  if (!expanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setExpanded(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
          title="Open Unified Data Inspector"
        >
          🔍 Inspect Unified Data ({stats.totalSemesters} semesters)
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-4 bg-white border-2 border-gray-300 rounded-lg shadow-xl z-50 overflow-auto">
      <div className="sticky top-0 bg-gray-100 px-4 py-3 border-b flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">🔍 Unified Data Inspector</h2>
        <button
          onClick={() => setExpanded(false)}
          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition-colors"
        >
          ✕ Close
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Summary Stats */}
        <section>
          <h3 className="text-lg font-semibold mb-3 text-blue-700">📊 Summary Statistics</h3>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>Total Semesters:</strong> {stats.totalSemesters}
              </div>
              <div>
                <strong>Selected Semester:</strong> {stats.globalInfo.selectedSemester || 'None'}
              </div>
              <div>
                <strong>Latest Valid Term:</strong> {stats.globalInfo.latestValidTerm || 'None'}
              </div>
            </div>
          </div>
        </section>

        {/* Semester Details */}
        <section>
          <h3 className="text-lg font-semibold mb-3 text-green-700">📅 Semester Breakdown</h3>
          <div className="space-y-3">
            {Object.entries(stats.semesterDetails).map(([semester, details]) => (
              <div key={semester} className="bg-green-50 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-lg">{semester}</h4>
                  <div className="flex gap-2">
                    {details.metadata.isCurrent && (
                      <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs">Current</span>
                    )}
                    {details.metadata.isProjected && (
                      <span className="bg-blue-500 text-white px-2 py-1 rounded-full text-xs">Projected</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <strong>Enrolled IDs:</strong> {details.enrolledIds}
                  </div>
                  <div>
                    <strong>Available:</strong> {details.availableCount}
                  </div>
                  <div>
                    <strong>Selected IDs:</strong> {details.selectedIds}
                  </div>
                  <div>
                    <strong>Filtered:</strong> {details.filteredCount}
                  </div>
                  <div>
                    <strong>Study Plan:</strong> {details.studyPlanCount}
                  </div>
                  <div>
                    <strong>Ratings:</strong> {details.ratingsCount}
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  <strong>CIS ID:</strong> {details.metadata.cisId || 'None'} | 
                  <strong> Last Fetched:</strong> {details.metadata.lastFetched ? 
                    new Date(details.metadata.lastFetched).toLocaleString() : 'Never'}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Selector Testing */}
        <section>
          <h3 className="text-lg font-semibold mb-3 text-purple-700">🧪 Selector Testing</h3>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Semester Selectors:
              </label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 w-full max-w-xs"
              >
                <option value="">Select a semester...</option>
                {availableSemesters.map(semester => (
                  <option key={semester} value={semester}>{semester}</option>
                ))}
              </select>
            </div>
            
            {selectedSemester && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold">Selected Courses ({selectedCoursesData?.length || 0}):</h4>
                  <pre className="bg-white p-2 rounded border text-xs max-h-32 overflow-auto">
                    {JSON.stringify(selectedCoursesData?.slice(0, 2), null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 className="font-semibold">Available Courses ({availableCoursesData?.length || 0}):</h4>
                  <pre className="bg-white p-2 rounded border text-xs max-h-32 overflow-auto">
                    {JSON.stringify(availableCoursesData?.slice(0, 2), null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Sample Course Data */}
        <section>
          <h3 className="text-lg font-semibold mb-3 text-orange-700">📚 Sample Course Data</h3>
          <div className="bg-orange-50 p-4 rounded-lg">
            {availableSemesters.length > 0 ? (
              <div>
                <h4 className="font-semibold mb-2">
                  Sample from {availableSemesters[0]} (First 2 available courses):
                </h4>
                <pre className="bg-white p-3 rounded border text-xs overflow-auto max-h-64">
                  {JSON.stringify(
                    unifiedData.semesters[availableSemesters[0]]?.available?.slice(0, 2) || [], 
                    null, 
                    2
                  )}
                </pre>
              </div>
            ) : (
              <p className="text-gray-600 italic">No semester data available</p>
            )}
          </div>
        </section>

        {/* Raw Data */}
        <section>
          <h3 className="text-lg font-semibold mb-3 text-red-700">🗂️ Full Raw Data</h3>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-red-600 mb-2">
              ⚠️ This shows the complete unified data structure. Use carefully in production.
            </p>
            <pre className="bg-white p-3 rounded border text-xs overflow-auto max-h-96">
              {JSON.stringify(unifiedData, null, 2)}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
};

export default UnifiedDataInspector;