/**
 * studyOverviewDataSelector.js
 * 
 * Recoil selector that merges scorecard data + unified course data for study overview
 * Similar to transcript selector but focused on progress tracking and planning
 */

import { selector } from 'recoil';
import { scorecardDataState } from './scorecardsAllRawAtom';
import { unifiedCourseDataState } from './unifiedCourseDataAtom';
import { transformScorecard } from '../helpers/transformScorecard';

export const studyOverviewDataSelector = selector({
  key: 'studyOverviewDataSelector',
  get: ({ get }) => {
    const scorecardData = get(scorecardDataState);
    const unifiedCourseData = get(unifiedCourseDataState);

    // Early return if no scorecard data
    if (!scorecardData.isLoaded || !scorecardData.rawScorecards) {
      return {
        isLoaded: false,
        programs: {},
        hasData: false,
        error: scorecardData.error || 'Scorecard data not loaded',
        overallProgress: null
      };
    }

    try {
      // Transform each program's scorecard data with progress focus
      const programs = {};
      let overallStats = {
        totalCreditsEarned: 0,
        totalCreditsRequired: 0,
        totalCoursesCompleted: 0,
        totalCoursesPlanned: 0,
        completionPercentage: 0
      };
      
      Object.entries(scorecardData.rawScorecards).forEach(([programId, rawData]) => {
        try {
          // Transform raw scorecard to semester-based structure
          const transformedScorecard = transformScorecard(rawData);
          
          // Calculate program-level progress
          let programStats = {
            creditsEarned: 0,
            creditsRequired: parseFloat(rawData.creditsDe || 0) + parseFloat(rawData.creditsEn || 0),
            coursesCompleted: 0,
            coursesPlanned: 0,
            completionPercentage: 0
          };

          // Enhance with selected courses from unified data for planning view
          const enhancedSemesters = {};
          
          // Process each semester from scorecard + unified data
          const allSemesters = new Set([
            ...Object.keys(transformedScorecard || {}),
            ...Object.keys(unifiedCourseData.semesters || {})
          ]);

          allSemesters.forEach(semesterKey => {
            const enrolledCourses = transformedScorecard?.[semesterKey] || [];
            const selectedCourses = unifiedCourseData.semesters?.[semesterKey]?.selectedIds || [];
            
            // Calculate semester-level stats
            const semesterCreditsEarned = enrolledCourses.reduce((sum, course) => {
              const credits = parseFloat(course.credits || course.ects || 0);
              return sum + (isNaN(credits) ? 0 : credits);
            }, 0);

            enhancedSemesters[semesterKey] = {
              // Study progress data
              enrolledCourses: enrolledCourses.map(course => ({
                ...course,
                source: 'completed',
                status: 'completed',
                isCompleted: true,
                isPlanned: false
              })),
              
              // Planning data
              selectedCourses: selectedCourses
                .filter(courseId => {
                  // Don't duplicate completed courses
                  return !enrolledCourses.some(enrolledCourse => 
                    enrolledCourse.courseId === courseId || 
                    enrolledCourse.id === courseId
                  );
                })
                .map(courseId => ({
                  id: courseId,
                  courseId: courseId,
                  source: 'planned',
                  status: 'planned',
                  isCompleted: false,
                  isPlanned: true
                })),
              
              // Semester summary
              semesterStats: {
                creditsEarned: semesterCreditsEarned,
                coursesCompleted: enrolledCourses.length,
                coursesPlanned: selectedCourses.length,
                hasActivity: enrolledCourses.length > 0 || selectedCourses.length > 0
              }
            };

            // Add to program totals
            programStats.creditsEarned += semesterCreditsEarned;
            programStats.coursesCompleted += enrolledCourses.length;
            programStats.coursesPlanned += selectedCourses.length;
          });

          // Calculate completion percentage
          programStats.completionPercentage = programStats.creditsRequired > 0 
            ? Math.round((programStats.creditsEarned / programStats.creditsRequired) * 100)
            : 0;

          programs[programId] = {
            rawData,
            transformedData: transformedScorecard,
            enhancedSemesters,
            programId,
            programStats,
            // Study overview specific data
            isMainProgram: rawData.isMainStudy || false,
            programType: programId.includes('Master') ? 'master' : 
                        programId.includes('Bachelor') ? 'bachelor' : 'other',
            requirementsFulfilled: {
              creditsDE: rawData.creditsFulfilledDe === true,
              creditsEN: rawData.creditsFulfilledEn === true,
              overall: rawData.creditsFulfilledDe === true && rawData.creditsFulfilledEn === true
            }
          };

          // Add to overall stats
          overallStats.totalCreditsEarned += programStats.creditsEarned;
          overallStats.totalCreditsRequired += programStats.creditsRequired;
          overallStats.totalCoursesCompleted += programStats.coursesCompleted;
          overallStats.totalCoursesPlanned += programStats.coursesPlanned;
          
        } catch (transformError) {
          console.error(`Error transforming scorecard for ${programId}:`, transformError);
          programs[programId] = {
            error: `Failed to transform: ${transformError.message}`,
            programId,
            rawData
          };
        }
      });

      // Calculate overall completion percentage
      overallStats.completionPercentage = overallStats.totalCreditsRequired > 0
        ? Math.round((overallStats.totalCreditsEarned / overallStats.totalCreditsRequired) * 100)
        : 0;

      return {
        isLoaded: true,
        programs,
        hasData: Object.keys(programs).length > 0,
        error: null,
        overallProgress: overallStats,
        // Metadata
        lastFetched: scorecardData.lastFetched,
        programIds: Object.keys(programs),
        totalPrograms: Object.keys(programs).length,
        // Planning context
        planningContext: {
          selectedSemester: unifiedCourseData.selectedSemester,
          availableSemesters: Object.keys(unifiedCourseData.semesters || {}),
          latestValidTerm: unifiedCourseData.latestValidTerm,
          totalPlannedCourses: Object.values(unifiedCourseData.semesters || {})
            .reduce((sum, semester) => sum + (semester.selectedIds?.length || 0), 0)
        }
      };

    } catch (error) {
      console.error('Error in studyOverviewDataSelector:', error);
      return {
        isLoaded: false,
        programs: {},
        hasData: false,
        error: `Selector error: ${error.message}`,
        overallProgress: null
      };
    }
  }
});

export default studyOverviewDataSelector;