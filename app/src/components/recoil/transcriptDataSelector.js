/**
 * @deprecated This file is unused and scheduled for removal.
 * Functionality migrated to unified state management system.
 * Last checked: December 2024
 */

/**
 * transcriptDataSelector.js
 * 
 * Recoil selector that merges scorecard data + unified course data for transcript view
 * Provides on-the-fly computation with real-time updates
 */

import { selector } from 'recoil';
import { scorecardDataState } from './scorecardsAllRawAtom';
import { unifiedCourseDataState } from './unifiedCourseDataAtom';
import { transformScorecard } from '../helpers/transformScorecard';

export const transcriptDataSelector = selector({
  key: 'transcriptDataSelector',
  get: ({ get }) => {
    const scorecardData = get(scorecardDataState);
    const unifiedCourseData = get(unifiedCourseDataState);

    // Early return if no scorecard data
    if (!scorecardData.isLoaded || !scorecardData.rawScorecards) {
      return {
        isLoaded: false,
        programs: {},
        hasData: false,
        error: scorecardData.error || 'Scorecard data not loaded'
      };
    }

    try {
      // Transform each program's scorecard data
      const programs = {};
      
      Object.entries(scorecardData.rawScorecards).forEach(([programId, rawData]) => {
        try {
          // Transform raw scorecard to semester-based structure
          const transformedScorecard = transformScorecard(rawData);
          
          // Enhance with selected courses from unified data
          const enhancedSemesters = {};
          
          // Process each semester from scorecard
          Object.entries(transformedScorecard || {}).forEach(([semesterKey, courses]) => {
            const selectedCourses = unifiedCourseData.semesters?.[semesterKey]?.selectedIds || [];
            
            enhancedSemesters[semesterKey] = {
              // Enrolled courses from scorecard (completed courses with grades)
              enrolledCourses: courses || [],
              
              // Selected courses from unified data (planning)
              selectedCourses: selectedCourses,
              
              // Combined view for transcript display
              allCourses: [
                // Mark enrolled courses
                ...(courses || []).map(course => ({
                  ...course,
                  source: 'enrolled',
                  isEnrolled: true,
                  isSelected: false
                })),
                // Mark selected courses (only if not already enrolled)
                ...selectedCourses
                  .filter(courseId => {
                    // Don't duplicate if course is already enrolled
                    return !(courses || []).some(enrolledCourse => 
                      enrolledCourse.courseId === courseId || 
                      enrolledCourse.id === courseId
                    );
                  })
                  .map(courseId => ({
                    id: courseId,
                    courseId: courseId,
                    source: 'selected',
                    isEnrolled: false,
                    isSelected: true,
                    // We'd need to get course details from unified data here
                    // For now, just include the ID
                  }))
              ]
            };
          });

          programs[programId] = {
            rawData,
            transformedData: transformedScorecard,
            enhancedSemesters,
            programId,
            // Summary stats
            totalEnrolledCourses: Object.values(enhancedSemesters).reduce(
              (sum, semester) => sum + (semester.enrolledCourses?.length || 0), 0
            ),
            totalSelectedCourses: Object.values(enhancedSemesters).reduce(
              (sum, semester) => sum + (semester.selectedCourses?.length || 0), 0
            ),
            semesterCount: Object.keys(enhancedSemesters).length
          };
          
        } catch (transformError) {
          console.error(`Error transforming scorecard for ${programId}:`, transformError);
          programs[programId] = {
            error: `Failed to transform: ${transformError.message}`,
            programId,
            rawData
          };
        }
      });

      return {
        isLoaded: true,
        programs,
        hasData: Object.keys(programs).length > 0,
        error: null,
        // Metadata
        lastFetched: scorecardData.lastFetched,
        programIds: Object.keys(programs),
        totalPrograms: Object.keys(programs).length,
        // Include unified course data info for debugging
        unifiedDataInfo: {
          selectedSemester: unifiedCourseData.selectedSemester,
          availableSemesters: Object.keys(unifiedCourseData.semesters || {}),
          latestValidTerm: unifiedCourseData.latestValidTerm
        }
      };

    } catch (error) {
      console.error('Error in transcriptDataSelector:', error);
      return {
        isLoaded: false,
        programs: {},
        hasData: false,
        error: `Selector error: ${error.message}`
      };
    }
  }
});

export default transcriptDataSelector;