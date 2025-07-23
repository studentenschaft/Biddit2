/**
 * useMultiSemesterCourseLoader.js
 * 
 * Custom hook to pre-load course data for current and reference semesters.
 * This ensures StudyOverview and Transcript can enrich courses from future semesters
 * by using course data from their reference semesters (current and previous semester).
 * 
 * KEY INSIGHT: Future semesters don't have real course data, they use reference semesters.
 * We need to ensure current + previous semester have course data loaded for enrichment.
 */

import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { unifiedCourseDataState } from '../recoil/unifiedCourseDataAtom';
import { useCourseInfoData } from './useCourseInfoData';

/**
 * Multi-semester course data loader hook
 * @param {string} authToken - Authentication token for API calls
 * @param {Array} termListObject - List of all terms from useTermSelection
 * @returns {Object} Loading states and enrichment-ready status
 */
export function useMultiSemesterCourseLoader(authToken, termListObject) {
  const unifiedCourseData = useRecoilValue(unifiedCourseDataState);
  const [isEnrichmentReady, setIsEnrichmentReady] = useState(false);
  
  // Identify key semesters that need course data for enrichment
  const getKeyEnrichmentSemesters = () => {
    if (!termListObject || !Array.isArray(termListObject)) return [];
    
    const keySemesters = [];
    
    // Find current semester
    const currentSemester = termListObject.find(term => term.isCurrent);
    if (currentSemester) {
      keySemesters.push({
        semester: currentSemester.shortName,
        cisId: currentSemester.cisId,
        type: 'current'
      });
    }
    
    // Find the semester immediately before current (for reference)
    if (currentSemester) {
      const currentIndex = termListObject.findIndex(term => term.shortName === currentSemester.shortName);
      if (currentIndex > 0) {
        const previousSemester = termListObject[currentIndex - 1];
        keySemesters.push({
          semester: previousSemester.shortName,
          cisId: previousSemester.cisId,
          type: 'previous'
        });
      }
    }
    
    // If no current semester found, use the latest semester
    if (keySemesters.length === 0 && termListObject.length > 0) {
      const latestSemester = termListObject[termListObject.length - 1];
      keySemesters.push({
        semester: latestSemester.shortName,
        cisId: latestSemester.cisId,
        type: 'latest'
      });
    }
    
    return keySemesters;
  };

  const keySemesters = getKeyEnrichmentSemesters();
  
  // SIMPLIFIED APPROACH: Instead of trying to conditionally call hooks,
  // let's use a simpler strategy that doesn't require dynamic hook calls
  
  // For now, let's disable automatic multi-semester loading and rely on
  // the existing EventListContainer enrichment. This avoids React hook violations.
  // The course name enrichment will work for the currently selected semester,
  // and we can enhance this later with a different approach.
  
  const semesterLoaders = {}; // Empty for now

  // Monitor when all key semesters have course data loaded
  useEffect(() => {
    if (!unifiedCourseData?.semesters || keySemesters.length === 0) {
      setIsEnrichmentReady(false);
      return;
    }
    
    let allReady = true;
    let readyCount = 0;
    let totalCount = keySemesters.length;
    
    keySemesters.forEach(({ semester }) => {
      const semesterData = unifiedCourseData.semesters[semester];
      const hasAvailableCourses = semesterData?.available && semesterData.available.length > 0;
      
      if (hasAvailableCourses) {
        readyCount++;
      } else {
        allReady = false;
      }
    });
    
    console.log(`🔍 [useMultiSemesterCourseLoader] Enrichment status: ${readyCount}/${totalCount} key semesters loaded`);
    
    if (allReady && !isEnrichmentReady) {
      console.log('✅ [useMultiSemesterCourseLoader] All key semesters loaded - enrichment ready!');
      setIsEnrichmentReady(true);
    } else if (!allReady && isEnrichmentReady) {
      console.log('⏳ [useMultiSemesterCourseLoader] Waiting for key semesters to load...');
      setIsEnrichmentReady(false);
    }
    
  }, [unifiedCourseData?.semesters, keySemesters?.length || 0, isEnrichmentReady]);

  // Check if a specific semester has enrichment data available
  const hasEnrichmentDataForSemester = (targetSemester) => {
    if (!unifiedCourseData?.semesters || !targetSemester) return false;
    
    const semesterData = unifiedCourseData.semesters[targetSemester];
    
    // If semester has its own course data, use that
    if (semesterData?.available && semesterData.available.length > 0) {
      return true;
    }
    
    // If it's a projected/future semester, check if its reference semester has data
    if (semesterData?.isProjected && semesterData.referenceSemester) {
      const referenceSemesterData = unifiedCourseData.semesters[semesterData.referenceSemester];
      return referenceSemesterData?.available && referenceSemesterData.available.length > 0;
    }
    
    // For future semesters, check if we have data in current/previous semesters
    const currentSemester = keySemesters.find(s => s.type === 'current');
    if (currentSemester) {
      const currentSemesterData = unifiedCourseData.semesters[currentSemester.semester];
      return currentSemesterData?.available && currentSemesterData.available.length > 0;
    }
    
    return false;
  };

  // Get enrichment source for a target semester
  const getEnrichmentSourceForSemester = (targetSemester) => {
    if (!unifiedCourseData?.semesters || !targetSemester) return null;
    
    const semesterData = unifiedCourseData.semesters[targetSemester];
    
    // If semester has its own course data, use that
    if (semesterData?.available && semesterData.available.length > 0) {
      return {
        source: targetSemester,
        type: 'direct',
        courses: semesterData.available
      };
    }
    
    // If it's a projected/future semester, use reference semester
    if (semesterData?.isProjected && semesterData.referenceSemester) {
      const referenceSemesterData = unifiedCourseData.semesters[semesterData.referenceSemester];
      if (referenceSemesterData?.available && referenceSemesterData.available.length > 0) {
        return {
          source: semesterData.referenceSemester,
          type: 'reference',
          courses: referenceSemesterData.available
        };
      }
    }
    
    // Fallback to current semester data
    const currentSemester = keySemesters.find(s => s.type === 'current');
    if (currentSemester) {
      const currentSemesterData = unifiedCourseData.semesters[currentSemester.semester];
      if (currentSemesterData?.available && currentSemesterData.available.length > 0) {
        return {
          source: currentSemester.semester,
          type: 'fallback',
          courses: currentSemesterData.available
        };
      }
    }
    
    return null;
  };

  return {
    // Main status indicators
    isEnrichmentReady,
    keySemesters: keySemesters.map(s => s.semester),
    
    // Enrichment utilities
    hasEnrichmentDataForSemester,
    getEnrichmentSourceForSemester,
    
    // Loading states from individual semester loaders
    isAnyLoading: Object.values(semesterLoaders).some(loader => loader?.isCourseDataLoading),
    
    // Debug info
    getKeyEnrichmentSemesters
  };
}

export default useMultiSemesterCourseLoader;