/**
 * StudyOverview.jsx
 * 
 * Modern study overview component using unified data architecture
 * Provides real-time updates, cross-semester visibility, and 1:1 visual parity with original
 */

import { useRecoilValue } from 'recoil';
import { unifiedAcademicDataSelector } from '../recoil/unifiedAcademicDataSelector';
import { unifiedCourseDataState } from '../recoil/unifiedCourseDataAtom';
import { useScorecardFetching } from '../helpers/useScorecardFetching';
import { useMultiSemesterCourseLoader } from '../helpers/useMultiSemesterCourseLoader';
import { useTermSelection } from '../helpers/useTermSelection';
import { authTokenState } from '../recoil/authAtom';
import LoadingText from '../common/LoadingText';
import { LoadingSkeletonStudyOverview } from './LoadingSkeletons';
import ProgramOverview from './studyOverview/components/ProgramOverview';
import { adaptAcademicDataForStudyOverview, getMainProgram } from './studyOverview/utils/dataAdapter';
import { useState } from 'react';

const StudyOverview = () => {
  const academicData = useRecoilValue(unifiedAcademicDataSelector);
  const unifiedCourseData = useRecoilValue(unifiedCourseDataState);
  const authToken = useRecoilValue(authTokenState);
  const scorecardFetching = useScorecardFetching();
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState(null);
  
  // Multi-semester course data loading for enrichment (simplified version)
  const { termListObject } = useTermSelection();
  const {
    isEnrichmentReady,
    keySemesters,
    hasEnrichmentDataForSemester,
    getEnrichmentSourceForSemester,
    isAnyLoading: isEnrichmentLoading
  } = useMultiSemesterCourseLoader(authToken, termListObject);

  // Convert our unified data to the format expected by ProgramOverview with course enrichment
  const adaptedData = adaptAcademicDataForStudyOverview(academicData, unifiedCourseData);
  const mainProgram = getMainProgram(adaptedData);

  // DEBUG: Detailed logging to investigate enrichment and course name display
  console.group('🔍 [StudyOverview] ENRICHMENT STATUS & DATA FLOW');
  
  console.log('1️⃣ MULTI-SEMESTER ENRICHMENT STATUS:', {
    isEnrichmentReady,
    keySemesters,
    isEnrichmentLoading,
    termListObjectLoaded: !!termListObject
  });
  
  console.log('2️⃣ RAW ACADEMIC DATA:', academicData);
  console.log('   - isLoaded:', academicData.isLoaded);
  console.log('   - hasData:', academicData.hasData);
  console.log('   - programs keys:', Object.keys(academicData.programs || {}));
  
  console.log('3️⃣ UNIFIED COURSE DATA FOR ENRICHMENT:', {
    totalSemesters: Object.keys(unifiedCourseData.semesters || {}).length,
    semestersWithAvailableCourses: Object.entries(unifiedCourseData.semesters || {})
      .filter(([, data]) => data.available?.length > 0)
      .map(([semester, data]) => ({
        semester,
        availableCoursesCount: data.available.length,
        sampleCourse: data.available[0]?.shortName || data.available[0]?.id
      }))
  });
  
  if (academicData.programs) {
    Object.entries(academicData.programs).forEach(([programId, programData]) => {
      console.log(`   - Program "${programId}":`, {
        isMainProgram: programData.isMainProgram,
        rawData: programData.rawData,
        studyOverviewView: programData.studyOverviewView,
        hasStudyOverviewData: Object.keys(programData.studyOverviewView || {}).length
      });
    });
  }
  
  console.log('3️⃣ ADAPTED DATA (with course enrichment):', adaptedData);
  console.log('   - programs keys:', Object.keys(adaptedData.programs || {}));
  
  if (adaptedData.programs) {
    Object.entries(adaptedData.programs).forEach(([programId, programData]) => {
      console.log(`   - Adapted Program "${programId}":`, {
        isMainProgram: programData.isMainProgram,
        semesterCount: Object.keys(programData.semesters || {}).length,
        semesters: Object.keys(programData.semesters || {}),
        rawScorecard: !!programData.rawScorecard
      });
      
      // Sample course data to verify enrichment
      Object.entries(programData.semesters || {}).forEach(([semester, courses]) => {
        if (courses.length > 0) {
          console.log(`     📚 ${semester} sample course:`, {
            name: courses[0].name,
            isEnriched: courses[0].isEnriched,
            source: courses[0].source,
            originalId: courses[0].courseId
          });
        }
      });
    });
  }
  
  console.log('4️⃣ MAIN PROGRAM RESULT:', mainProgram);
  
  console.groupEnd();

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
      <div className="flex flex-col px-8 py-4">
        <h1 className="text-2xl font-bold mb-4">Study Overview</h1>
        <div className="mb-6">
          <LoadingText>Loading your saved courses...</LoadingText>
          <LoadingSkeletonStudyOverview />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col px-8 py-4">
      <h1 className="text-2xl font-bold mb-4">Study Overview</h1>

      {/* Render programs exactly like the original StudyOverview */}
      {Object.entries(adaptedData.programs).map(([programId, programData], index, array) => (
        <div key={programId}>
          <ProgramOverview
            program={programData.id || programId}
            semesters={programData.semesters}
            selectedSemester={selectedSemester}
            setSelectedSemester={setSelectedSemester}
            rawScorecard={programData.rawScorecard}
          />
          {/* Add gradient separator between programs (like original) */}
          {index < array.length - 1 && (
            <div className="my-8 h-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
          )}
        </div>
      ))}

      {/* Show friendly message only if no programs at all */}
      {Object.keys(adaptedData.programs).length === 0 && (
        <div className="text-center py-8 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200">
          <div className="space-y-4">
            <div className="text-6xl">🎓</div>
            <h3 className="text-xl font-semibold text-gray-800">Ready to Start Planning?</h3>
            <div className="text-gray-600 space-y-2">
              <p>No study data found yet. To see your beautiful semester overview:</p>
              <div className="bg-white p-4 rounded-lg shadow-sm max-w-md mx-auto">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center space-x-3">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">Step 1</span>
                    <span>Click <strong>"Load Study Data"</strong> above to fetch completed courses</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">Step 2</span>
                    <span>Go to <strong>Course Selection</strong> tab to pick future courses</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">Step 3</span>
                    <span>Return here to see colorful <strong>semester bars</strong>!</span>
                  </div>
                </div>
              </div>
              
              {/* Sample visualization */}
              <div className="mt-6 max-w-lg mx-auto">
                <p className="text-sm text-gray-500 mb-3">Preview: Semester bars will look like this</p>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="grid grid-cols-12 gap-2 items-center text-sm">
                    <div className="col-span-2 font-semibold text-gray-700">HS24</div>
                    <div className="col-span-8 flex h-6 bg-gray-100 rounded">
                      <div className="bg-blue-500 h-full rounded-l" style={{width: '30%'}} title="Core courses"></div>
                      <div className="bg-green-500 h-full" style={{width: '25%'}} title="Electives"></div>
                      <div className="bg-purple-500 h-full" style={{width: '20%'}} title="Planned courses"></div>
                      <div className="bg-orange-500 h-full rounded-r" style={{width: '15%'}} title="Specialization"></div>
                    </div>
                    <div className="col-span-2 text-right font-semibold text-gray-600">28 ECTS</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StudyOverview;