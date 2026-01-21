/**
 * useUnifiedCourseLoader.js
 * 
 * Single unified course data loader for academic components.
 * Combines functionality from useMultiSemesterCourseLoader and useStudyOverviewCourseLoader
 * into one simple, efficient hook.
 * 
 * Responsibilities:
 * - Load course data for semesters with selected courses (proactive loading)
 * - Load reference semester data for future semesters (enrichment)  
 * - Provide loading status and enrichment utilities
 */

import { useEffect, useState, useMemo } from 'react';
import { useUnifiedCourseData } from './useUnifiedCourseData';
import { useRecoilValue } from 'recoil';
import { termListState } from '../recoil/termListState';

/**
 * Identifies semesters that need course data loading
 * @param {Object} unifiedCourseData - Current course data state
 * @param {Array} termListObject - Available terms with metadata
 * @returns {Array} Semesters needing data with loading strategy
 */
const identifySemestersNeedingData = (unifiedCourseData, termListObject) => {
  const semestersNeedingData = [];
  
  if (!unifiedCourseData?.semesters || !termListObject) {
    return semestersNeedingData;
  }

  Object.entries(unifiedCourseData.semesters).forEach(([semesterKey, semesterData]) => {
    const hasSelectedIds = semesterData?.selectedIds?.length > 0;
    const hasAvailableCourses = semesterData?.available?.length > 0;
    
    // Load course data if we have selected courses but no catalog data
    if (hasSelectedIds && !hasAvailableCourses) {
      semestersNeedingData.push({
        semesterKey,
        loadingStrategy: 'proactive', // Load because we have selected courses
        targetSemester: semesterData?.isProjected && semesterData?.referenceSemester 
          ? semesterData.referenceSemester 
          : semesterKey,
        selectedCount: semesterData.selectedIds.length
      });
    }
    
    // Also ensure reference semesters are loaded for future semesters with selected courses
    if (hasSelectedIds && semesterData?.isProjected && semesterData?.referenceSemester) {
      const referenceSemesterData = unifiedCourseData.semesters[semesterData.referenceSemester];
      const referenceHasData = referenceSemesterData?.available?.length > 0;
      
      if (!referenceHasData) {
        const alreadyQueued = semestersNeedingData.some(s => s.targetSemester === semesterData.referenceSemester);
        if (!alreadyQueued) {
          semestersNeedingData.push({
            semesterKey: semesterData.referenceSemester,
            loadingStrategy: 'reference', // Load for enrichment purposes
            targetSemester: semesterData.referenceSemester,
            selectedCount: 0
          });
        }
      }
    }
  });

  return semestersNeedingData;
};

/**
 * Unified course loader hook for academic components
 * @param {string} authToken - Authentication token for API calls
 * @param {Object} unifiedCourseData - Current unified course data state  
 * @param {Object} academicData - Academic data from selector
 * @returns {Object} Loading states and utilities
 */
export function useUnifiedCourseLoader(authToken, unifiedCourseData) {
  const termListObject = useRecoilValue(termListState);
  const { updateAvailableCourses } = useUnifiedCourseData();
  const [loadedSemesters, setLoadedSemesters] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Identify semesters that need course data
  const semestersNeedingData = useMemo(() => 
    identifySemestersNeedingData(unifiedCourseData, termListObject),
    [unifiedCourseData, termListObject]
  );

  // Load course data for identified semesters
  useEffect(() => {
    if (!authToken || !termListObject || semestersNeedingData.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    semestersNeedingData.forEach(async (semesterInfo) => {
      const { targetSemester } = semesterInfo;
      
      // Skip if already loaded
      if (loadedSemesters.has(targetSemester)) {
        return;
      }

      // Find semester metadata
      const targetSemesterInfo = termListObject.find(term => term.shortName === targetSemester);
      if (!targetSemesterInfo) {
        return;
      }

      // Mark as being processed
      setLoadedSemesters(prev => new Set([...prev, targetSemester]));

      try {
        const response = await fetch(
          `https://integration.unisg.ch/EventApi/CourseInformationSheets/myLatestPublishedPossiblebyTerm/${targetSemesterInfo.cisId}`,
          {
            headers: {
              "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
              "X-RequestedLanguage": "EN",
              "API-Version": "1",
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (response.ok) {
          const courseData = await response.json();
          updateAvailableCourses(targetSemester, courseData);
        }
      } catch (error) {
        // Silently handle errors - enrichment will fall back to course IDs
      }
    });

    // Check if loading is complete
    const stillNeedingData = identifySemestersNeedingData(unifiedCourseData, termListObject);
    if (stillNeedingData.length === 0) {
      setIsLoading(false);
    }

  }, [authToken, semestersNeedingData, termListObject, loadedSemesters, updateAvailableCourses, unifiedCourseData]);

  // Check if enrichment data is available for a semester
  const hasEnrichmentDataForSemester = (semesterKey) => {
    if (!unifiedCourseData?.semesters || !semesterKey) return false;
    
    const semesterData = unifiedCourseData.semesters[semesterKey];
    
    // Direct data available
    if (semesterData?.available?.length > 0) {
      return true;
    }
    
    // Reference semester data available
    if (semesterData?.isProjected && semesterData.referenceSemester) {
      const referenceSemesterData = unifiedCourseData.semesters[semesterData.referenceSemester];
      return referenceSemesterData?.available?.length > 0;
    }
    
    return false;
  };

  return {
    // Loading states
    isLoading,
    isEnrichmentReady: semestersNeedingData.length === 0,
    
    // Enrichment utilities  
    hasEnrichmentDataForSemester,
    totalSemestersNeeded: semestersNeedingData.length,
    
    // Semester metadata
    termListObject,
    
    // Debug info
    semestersNeedingData: semestersNeedingData.map(s => s.semesterKey)
  };
}

export default useUnifiedCourseLoader;
