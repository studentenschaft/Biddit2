/**
 * useStudyOverviewCourseLoader.js
 * 
 * Proactive course data loader for StudyOverview component.
 * Identifies semesters with selected courses but no course catalog data,
 * then triggers loading to prevent "Loading..." displays.
 */

import { useEffect, useState, useMemo } from 'react';
import { useUnifiedCourseData } from './useUnifiedCourseData';

/**
 * Identifies semesters that have selected courses but lack course catalog data
 */
const identifySemestersNeedingData = (unifiedCourseData, academicData) => {
  const semestersNeedingData = [];
  
  if (!academicData?.isLoaded || !academicData?.programs || !unifiedCourseData?.semesters) {
    return semestersNeedingData;
  }

  Object.entries(unifiedCourseData.semesters).forEach(([semesterKey, semesterData]) => {
    const hasSelectedIds = semesterData?.selectedIds?.length > 0;
    const hasAvailableCourses = semesterData?.available?.length > 0;
    
    if (hasSelectedIds && !hasAvailableCourses) {
      semestersNeedingData.push({
        semesterKey,
        cisId: semesterData?.cisId,
        isProjected: semesterData?.isProjected,
        referenceSemester: semesterData?.referenceSemester,
        selectedCount: semesterData?.selectedIds?.length || 0
      });
    }
  });

  return semestersNeedingData;
};

export function useStudyOverviewCourseLoader(authToken, unifiedCourseData, academicData, termListObject) {
  const { updateAvailableCourses } = useUnifiedCourseData();
  const [loadedSemesters, setLoadedSemesters] = useState(new Set());

  const semestersNeedingData = useMemo(() => 
    identifySemestersNeedingData(unifiedCourseData, academicData),
    [unifiedCourseData, academicData]
  );

  useEffect(() => {
    if (!authToken || !termListObject || semestersNeedingData.length === 0) {
      return;
    }

    semestersNeedingData.forEach(async (semesterInfo) => {
      const { semesterKey, isProjected, referenceSemester } = semesterInfo;
      
      if (loadedSemesters.has(semesterKey)) {
        return;
      }

      let targetSemesterKey = semesterKey;
      
      // For projected semesters, try to use their reference semester
      if (isProjected && referenceSemester) {
        const referenceSemesterExists = unifiedCourseData.semesters[referenceSemester];
        const referenceHasData = referenceSemesterExists?.available?.length > 0;
        
        if (!referenceHasData) {
          targetSemesterKey = referenceSemester;
        }
      }

      const targetSemesterInfo = termListObject.find(term => term.shortName === targetSemesterKey);
      
      if (!targetSemesterInfo) {
        return;
      }

      setLoadedSemesters(prev => new Set([...prev, semesterKey]));

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
          updateAvailableCourses(targetSemesterKey, courseData);
        }
      } catch (error) {
        // Silently handle errors - course enrichment will fall back to showing course IDs
      }
    });
  }, [authToken, semestersNeedingData, termListObject, loadedSemesters, updateAvailableCourses, unifiedCourseData.semesters]);

  return {
    isLoading: semestersNeedingData.length > 0 && loadedSemesters.size < semestersNeedingData.length,
    totalSemestersNeeded: semestersNeedingData.length
  };
}

export default useStudyOverviewCourseLoader;