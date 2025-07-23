/**
 * UnifiedTranscript.jsx
 * 
 * Modern transcript component using unifiedAcademicDataSelector
 * Displays completed courses with grades + planned courses in transcript format
 */

import { useRecoilValue } from 'recoil';
import { unifiedAcademicDataSelector } from '../recoil/unifiedAcademicDataSelector';
import { useScorecardFetching } from '../helpers/useScorecardFetching';
import { authTokenState } from '../recoil/authAtom';
import LoadingText from '../common/LoadingText';
import { useState } from 'react';

const UnifiedTranscript = () => {
  const academicData = useRecoilValue(unifiedAcademicDataSelector);
  const authToken = useRecoilValue(authTokenState);
  const scorecardFetching = useScorecardFetching();
  const [fetchAttempted, setFetchAttempted] = useState(false);

  // Auto-fetch scorecard data if not loaded and haven't tried yet
  const handleFetchIfNeeded = async () => {
    if (!academicData.isLoaded && !fetchAttempted && authToken) {
      setFetchAttempted(true);
      await scorecardFetching.fetchAll(authToken);
    }
  };

  // Trigger fetch if needed
  if (!academicData.isLoaded && !fetchAttempted && authToken) {
    handleFetchIfNeeded();
  }

  if (!academicData.isLoaded) {
    return (
      <div className="p-6 bg-white rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">📋 Academic Transcript</h2>
          {!fetchAttempted && authToken && (
            <button
              onClick={handleFetchIfNeeded}
              disabled={scorecardFetching.isFetchingScorecards || scorecardFetching.isFetchingEnrollments}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {scorecardFetching.isFetchingScorecards || scorecardFetching.isFetchingEnrollments 
                ? "Loading..." 
                : "Load Transcript"}
            </button>
          )}
        </div>
        
        {fetchAttempted ? (
          <LoadingText>Loading transcript data...</LoadingText>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Click "Load Transcript" to fetch your academic data</p>
          </div>
        )}
        
        {academicData.error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-red-700">Error: {academicData.error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">📋 Academic Transcript</h1>
        <p className="text-sm text-gray-600">
          Official transcript with completed courses and planned selections
        </p>
        {academicData.lastFetched && (
          <p className="text-xs text-gray-500 mt-1">
            Last updated: {new Date(academicData.lastFetched).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Overall Progress Summary */}
      {academicData.overallProgress && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">📊 Overall Progress</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium text-blue-700">Credits Earned</div>
              <div className="text-lg">{academicData.overallProgress.totalCreditsEarned.toFixed(1)}</div>
            </div>
            <div>
              <div className="font-medium text-blue-700">Credits Required</div>
              <div className="text-lg">{academicData.overallProgress.totalCreditsRequired.toFixed(1)}</div>
            </div>
            <div>
              <div className="font-medium text-blue-700">Completion</div>
              <div className="text-lg">{academicData.overallProgress.completionPercentage}%</div>
            </div>
            <div>
              <div className="font-medium text-blue-700">Planned Courses</div>
              <div className="text-lg">{academicData.overallProgress.totalCoursesPlanned}</div>
            </div>
          </div>
        </div>
      )}

      {/* Programs */}
      {Object.entries(academicData.transcriptView).map(([programId, transcriptData]) => {
        const program = academicData.programs[programId];
        
        if (transcriptData.error) {
          return (
            <div key={programId} className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h2 className="font-bold text-red-800">{programId}</h2>
              <p className="text-red-700">{transcriptData.error}</p>
            </div>
          );
        }

        return (
          <div key={programId} className="mb-8 border border-gray-200 rounded-lg overflow-hidden">
            {/* Program Header */}
            <div className="bg-gray-50 p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">
                  {program?.isMainProgram && <span className="text-blue-600 mr-2">⭐</span>}
                  {programId}
                </h2>
                <div className="text-sm text-gray-600">
                  {program?.programStats?.completionPercentage}% Complete
                </div>
              </div>
              
              {/* Program Requirements */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                <div>
                  <span className="font-medium">Credits DE:</span> 
                  <span className={`ml-1 ${transcriptData.programInfo?.creditsFulfilledDE ? 'text-green-600' : 'text-orange-600'}`}>
                    {transcriptData.programInfo?.creditsDE || 0}
                    {transcriptData.programInfo?.creditsFulfilledDE && ' ✓'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Credits EN:</span>
                  <span className={`ml-1 ${transcriptData.programInfo?.creditsFulfilledEN ? 'text-green-600' : 'text-orange-600'}`}>
                    {transcriptData.programInfo?.creditsEN || 0}
                    {transcriptData.programInfo?.creditsFulfilledEN && ' ✓'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Completed:</span>
                  <span className="ml-1">{transcriptData.completedCourses?.length || 0} courses</span>
                </div>
                <div>
                  <span className="font-medium">Planned:</span>
                  <span className="ml-1 text-blue-600">{transcriptData.plannedCourses?.length || 0} courses</span>
                </div>
              </div>
            </div>

            <div className="p-4">
              {/* Completed Courses */}
              {transcriptData.completedCourses && transcriptData.completedCourses.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-800 mb-3">✅ Completed Courses</h3>
                  <div className="space-y-2">
                    {transcriptData.completedCourses.map((course, index) => (
                      <div key={`completed-${index}`} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded">
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">
                            {course.name || course.courseName || course.id || 'Course Name'}
                          </div>
                          {course.shortName && (
                            <div className="text-sm text-gray-600">{course.shortName}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          {course.credits && (
                            <div className="text-gray-600">
                              {parseFloat(course.credits).toFixed(1)} ECTS
                            </div>
                          )}
                          <div className={`font-bold px-2 py-1 rounded ${
                            parseFloat(course.gradeText) >= 4.0 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            Grade: {course.gradeText}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Planned Courses */}
              {transcriptData.plannedCourses && transcriptData.plannedCourses.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3">📋 Planned Courses</h3>
                  <div className="space-y-2">
                    {transcriptData.plannedCourses.map((course, index) => (
                      <div key={`planned-${index}`} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">
                            {course.name || course.courseName || course.courseId || course.id}
                          </div>
                          <div className="text-sm text-blue-600">Selected for future semester</div>
                        </div>
                        <div className="text-sm text-blue-700 font-medium">
                          Planned
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No courses message */}
              {(!transcriptData.completedCourses || transcriptData.completedCourses.length === 0) &&
               (!transcriptData.plannedCourses || transcriptData.plannedCourses.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  <p>No completed or planned courses found for this program</p>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Planning Context */}
      {academicData.planningContext && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">📅 Planning Context</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">Selected Semester:</span> {academicData.planningContext.selectedSemester || 'None'}
            </div>
            <div>
              <span className="font-medium">Available Semesters:</span> {academicData.planningContext.availableSemesters?.length || 0}
            </div>
            <div>
              <span className="font-medium">Total Planned:</span> {academicData.planningContext.totalPlannedCourses || 0} courses
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedTranscript;