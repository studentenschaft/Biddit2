/**
 * unifiedAcademicDataSelector.js
 * 
 * Single comprehensive selector that provides both transcript and study overview formats
 * Merges scorecard data + unified course data with different views for different components
 */

import { selector } from 'recoil';
import { scorecardDataState } from './scorecardsAllRawAtom';
import { unifiedCourseDataState } from './unifiedCourseDataAtom';
import { transformScorecard } from '../helpers/transformScorecard';

export const unifiedAcademicDataSelector = selector({
  key: 'unifiedAcademicDataSelector',
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
        // Both views return empty when not loaded
        transcriptView: {},
        studyOverviewView: {},
        overallProgress: null
      };
    }

    try {
      const programs = {};
      let overallStats = {
        totalCreditsEarned: 0,
        totalCreditsRequired: 0,
        totalCoursesCompleted: 0,
        totalCoursesPlanned: 0,
        completionPercentage: 0
      };
      
      // First pass: Identify the main program with intelligent fallback
      let mainProgramId = null;
      const programEntries = Object.entries(scorecardData.rawScorecards);
      
      // Strategy 1: Look for explicitly marked main program
      const explicitMain = programEntries.find(([, rawData]) => rawData.isMainStudy);
      if (explicitMain) {
        mainProgramId = explicitMain[0];
        console.log(`🎯 [unifiedAcademicDataSelector] Found explicitly marked main program: ${mainProgramId}`);
      } else {
        console.log(`⚠️ [unifiedAcademicDataSelector] No explicitly marked main program, using fallback strategies...`);
        
        // Strategy 2: Prefer Master programs, then Bachelor programs
        const masterProgram = programEntries.find(([programId]) => 
          programId.toLowerCase().includes('master')
        );
        
        if (masterProgram) {
          mainProgramId = masterProgram[0];
          console.log(`✅ [unifiedAcademicDataSelector] Using Master program as main: ${mainProgramId}`);
        } else {
          const bachelorProgram = programEntries.find(([programId]) => 
            programId.toLowerCase().includes('bachelor')
          );
          
          if (bachelorProgram) {
            mainProgramId = bachelorProgram[0];
            console.log(`✅ [unifiedAcademicDataSelector] Using Bachelor program as main: ${mainProgramId}`);
          } else {
            // Strategy 3: Use first program as final fallback
            mainProgramId = programEntries[0]?.[0];
            console.log(`⚠️ [unifiedAcademicDataSelector] Using first available program as fallback: ${mainProgramId}`);
          }
        }
      }
      
      Object.entries(scorecardData.rawScorecards).forEach(([programId, rawData]) => {
        try {
          // Transform for semester-based planning view
          const transformedScorecard = transformScorecard(rawData);
          
          // Program-level stats
          let programStats = {
            creditsEarned: 0,
            creditsRequired: parseFloat(rawData.creditsDe || 0) + parseFloat(rawData.creditsEn || 0),
            coursesCompleted: 0,
            coursesPlanned: 0,
            completionPercentage: 0
          };

          // Build TRANSCRIPT VIEW - Preserves hierarchical structure like actual transcript
          const transcriptView = {
            programInfo: {
              id: programId,
              creditsDE: rawData.creditsDe,
              creditsEN: rawData.creditsEn,
              creditsFulfilledDE: rawData.creditsFulfilledDe,
              creditsFulfilledEN: rawData.creditsFulfilledEn,
              isProcessing: rawData.isProcessing,
              minCreditsDE: rawData.minCreditsDe,
              minCreditsEN: rawData.minCreditsEn
            },
            // Keep hierarchical structure for transcript display
            hierarchicalStructure: rawData.items || [],
            // Flatten completed courses with grades for easy display
            completedCourses: [],
            // Add selected courses that aren't completed yet
            plannedCourses: []
          };

          // Extract completed courses from hierarchical structure
          const extractCompletedCourses = (items, level = 0) => {
            (items || []).forEach(item => {
              if (item.items && Array.isArray(item.items)) {
                extractCompletedCourses(item.items, level + 1);
              } else if (!item.isTitle && item.gradeText && item.gradeText !== "") {
                transcriptView.completedCourses.push({
                  ...item,
                  level,
                  source: 'completed',
                  isCompleted: true
                });
                
                // Add to program stats
                const credits = parseFloat(item.credits || item.ects || 0);
                if (!isNaN(credits)) {
                  programStats.creditsEarned += credits;
                }
                programStats.coursesCompleted++;
              }
            });
          };

          extractCompletedCourses(rawData.items);

          // Build STUDY OVERVIEW VIEW - Semester-based for planning
          const studyOverviewView = {};
          
          // Process semesters from both scorecard and unified data
          const allSemesters = new Set([
            ...Object.keys(transformedScorecard || {}),
            ...Object.keys(unifiedCourseData.semesters || {})
          ]);

          allSemesters.forEach(semesterKey => {
            const enrolledCourses = transformedScorecard?.[semesterKey] || [];
            
            // MAIN PROGRAM FILTERING: Only include selected courses for the main program
            const isMainProgram = programId === mainProgramId;
            const enrolledIdsFromUnified = unifiedCourseData.semesters?.[semesterKey]?.enrolledIds || [];
            const selectedIdsFromUnified = isMainProgram 
              ? (unifiedCourseData.semesters?.[semesterKey]?.selectedIds || [])
              : []; // Empty array for non-main programs

            // Union to ensure assigned (enrolledIds) also surface in planning views (StudyOverview/Transcript)
            const selectedCourseIds = Array.from(
              new Set([...(selectedIdsFromUnified || []), ...(enrolledIdsFromUnified || [])])
            );
            
            // ENHANCED COURSE ENRICHMENT: Use existing enriched data from unified system with fallback logic
            let availableCourses = unifiedCourseData.semesters?.[semesterKey]?.available || [];
            
            // If no courses available for this semester, try to find them in reference semesters
            if (availableCourses.length === 0) {
              const semesterData = unifiedCourseData.semesters?.[semesterKey];
              
              // For projected/future semesters, try their reference semester
              if (semesterData?.isProjected && semesterData.referenceSemester) {
                const referenceSemesterData = unifiedCourseData.semesters[semesterData.referenceSemester];
                if (referenceSemesterData?.available?.length > 0) {
                  availableCourses = referenceSemesterData.available;
                  console.log(`🔄 [unifiedAcademicDataSelector] Using reference semester ${semesterData.referenceSemester} for enrichment of ${semesterKey}`);
                }
              }
              
              // If still no courses, try current semester as fallback
              if (availableCourses.length === 0) {
                const currentSemesterKey = Object.keys(unifiedCourseData.semesters || {}).find(key => 
                  unifiedCourseData.semesters[key].isCurrent
                );
                if (currentSemesterKey && currentSemesterKey !== semesterKey) {
                  const currentSemesterData = unifiedCourseData.semesters[currentSemesterKey];
                  if (currentSemesterData?.available?.length > 0) {
                    availableCourses = currentSemesterData.available;
                    console.log(`🔄 [unifiedAcademicDataSelector] Using current semester ${currentSemesterKey} for enrichment of ${semesterKey}`);
                  }
                }
              }
            }
            
            const selectedCourses = selectedCourseIds.map(courseId => {
              // Try to find full course data by matching courseId (leveraging existing enrichment)
              const fullCourse = availableCourses.find(course => 
                course.courseNumber === courseId || 
                course.id === courseId ||
                course.courses?.[0]?.courseNumber === courseId
              );
              
              if (fullCourse) {
                // Use existing enriched course data (already processed by EventListContainer system)
                return {
                  id: courseId,
                  courseId: courseId,
                  name: fullCourse.shortName || fullCourse.name || courseId,
                  credits: fullCourse.credits != null ? parseFloat(fullCourse.credits) / 100 : 3, // Preserve 0 credits, default to 3 for null/undefined
                  type: fullCourse.classification || 'elective',
                  classification: fullCourse.classification,
                  avgRating: fullCourse.avgRating,
                  source: 'planned',
                  status: 'planned',
                  isCompleted: false,
                  isPlanned: true,
                  isEnriched: true, // Leveraging existing EventListContainer enrichment
                  // Mark if this planned item is assigned/enrolled from backend
                  isAssigned: enrolledIdsFromUnified.includes(courseId)
                };
              } else {
                // Fallback when course not found in available data
                return {
                  id: courseId,
                  courseId: courseId,
                  name: courseId, // Will show ID until semester data is loaded
                  credits: 3, // Default credits
                  type: 'elective',
                  source: 'planned',
                  status: 'planned', 
                  isCompleted: false,
                  isPlanned: true,
                  isEnriched: false, // Not enriched - semester data may not be loaded yet
                  isAssigned: enrolledIdsFromUnified.includes(courseId)
                };
              }
            });
            
            // DEBUG: Only log semesters with selected courses to reduce noise
            if (selectedCourses.length > 0) {
              console.log(`✅ [unifiedAcademicDataSelector] ${semesterKey} has ${selectedCourses.length} selected courses in MAIN PROGRAM (${programId}):`, selectedCourses);
            } else if (unifiedCourseData.semesters?.[semesterKey]?.selectedIds?.length > 0 && !isMainProgram) {
              console.log(`ℹ️ [unifiedAcademicDataSelector] ${semesterKey} has selected courses but skipping for non-main program (${programId})`);
            }

            // Debug snapshot for derived assigned
            if ((enrolledIdsFromUnified || []).length > 0) {
              console.log('[uADS] derivedAssigned', {
                semester: semesterKey,
                enrolledIds: enrolledIdsFromUnified.length,
                selectedIds: selectedIdsFromUnified.length,
                unionIds: selectedCourseIds.length,
                matched: selectedCourses.filter(c => c.isAssigned).length
              });
            }
            
            studyOverviewView[semesterKey] = {
              enrolledCourses: enrolledCourses.map(course => ({
                ...course,
                source: 'completed',
                status: 'completed',
                isCompleted: true,
                isPlanned: false
              })),
              
              selectedCourses: selectedCourses
                .filter(course => {
                  // Don't duplicate completed courses - selectedCourses are now enriched objects, not IDs
                  return !enrolledCourses.some(enrolledCourse => 
                    enrolledCourse.courseId === course.courseId || 
                    enrolledCourse.id === course.id ||
                    enrolledCourse.courseId === course.id
                  );
                })
                .map(course => ({
                  ...course, // Keep all enriched course data
                  source: 'planned',
                  status: 'planned',
                  isCompleted: false,
                  isPlanned: true
                })),
              
              semesterStats: {
                creditsEarned: enrolledCourses.reduce((sum, course) => {
                  const credits = parseFloat(course.credits || course.ects || 0);
                  return sum + (isNaN(credits) ? 0 : credits);
                }, 0),
                coursesCompleted: enrolledCourses.length,
                coursesPlanned: selectedCourses.length,
                hasActivity: enrolledCourses.length > 0 || selectedCourses.length > 0
              }
            };

            // Update program stats with planning data
            programStats.coursesPlanned += selectedCourses.length;
          });

          // Add selected courses to transcript view (as planned courses) - ONLY for main program
          if (programId === mainProgramId) {
            Object.values(unifiedCourseData.semesters || {}).forEach(semester => {
              (semester.selectedIds || []).forEach(courseId => {
                // Only add if not already completed
                if (!transcriptView.completedCourses.some(course => 
                  course.courseId === courseId || course.id === courseId
                )) {
                  transcriptView.plannedCourses.push({
                    id: courseId,
                    courseId: courseId,
                    source: 'planned',
                    status: 'planned',
                    isCompleted: false,
                    isPlanned: true
                  });
                }
              });
            });
          }

          // Calculate completion percentage
          programStats.completionPercentage = programStats.creditsRequired > 0 
            ? Math.round((programStats.creditsEarned / programStats.creditsRequired) * 100)
            : 0;

          programs[programId] = {
            rawData,
            transcriptView,
            studyOverviewView,
            programStats,
            programId,
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
          console.error(`Error processing program ${programId}:`, transformError);
          programs[programId] = {
            error: `Failed to process: ${transformError.message}`,
            programId,
            rawData,
            transcriptView: {},
            studyOverviewView: {}
          };
        }
      });

      // Calculate overall completion percentage
      overallStats.completionPercentage = overallStats.totalCreditsRequired > 0
        ? Math.round((overallStats.totalCreditsEarned / overallStats.totalCreditsRequired) * 100)
        : 0;

      // DEBUG: Log summary of semesters with selected courses across all programs
      const allSelectedCoursesCount = Object.values(programs).reduce((total, program) => {
        return total + Object.values(program.studyOverviewView).reduce((semTotal, semester) => {
          return semTotal + (semester.selectedCourses?.length || 0);
        }, 0);
      }, 0);
      
      if (allSelectedCoursesCount > 0) {
        console.log(`🎯 [unifiedAcademicDataSelector] Found ${allSelectedCoursesCount} total selected courses across all programs and semesters`);
      }

      return {
        isLoaded: true,
        programs,
        hasData: Object.keys(programs).length > 0,
        error: null,
        overallProgress: overallStats,
        
        // TRANSCRIPT VIEW: Hierarchical structure preserving official transcript format
        transcriptView: Object.fromEntries(
          Object.entries(programs).map(([programId, program]) => [
            programId, 
            program.transcriptView
          ])
        ),
        
        // STUDY OVERVIEW VIEW: Semester-based planning view
        studyOverviewView: Object.fromEntries(
          Object.entries(programs).map(([programId, program]) => [
            programId, 
            program.studyOverviewView
          ])
        ),
        
        // Metadata
        lastFetched: scorecardData.lastFetched,
        programIds: Object.keys(programs),
        totalPrograms: Object.keys(programs).length,
        planningContext: {
          selectedSemester: unifiedCourseData.selectedSemester,
          availableSemesters: Object.keys(unifiedCourseData.semesters || {}),
          latestValidTerm: unifiedCourseData.latestValidTerm,
          totalPlannedCourses: Object.values(unifiedCourseData.semesters || {})
            .reduce((sum, semester) => sum + (semester.selectedIds?.length || 0), 0)
        }
      };

    } catch (error) {
      console.error('Error in unifiedAcademicDataSelector:', error);
      return {
        isLoaded: false,
        programs: {},
        hasData: false,
        error: `Selector error: ${error.message}`,
        transcriptView: {},
        studyOverviewView: {},
        overallProgress: null
      };
    }
  }
});

export default unifiedAcademicDataSelector;
