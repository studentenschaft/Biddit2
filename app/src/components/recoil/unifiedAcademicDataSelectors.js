import { selector } from "recoil";
import { unifiedAcademicDataState } from "./unifiedAcademicDataAtom";
import { unifiedCourseDataState } from "./unifiedCourseDataAtom";
import { localSelectedCoursesSemKeyState } from "./localSelectedCoursesSemKeyAtom";
import { processExerciseGroupECTS } from "../helpers/smartExerciseGroupHandler";
import {
  enrichCourseFromAvailable,
  getAvailableCoursesWithFallback,
  findMainProgram
} from "../helpers/academicDataTransformers";

/**
 * Selector to get the current program data
 * Provides easy access to the currently selected academic program
 */
export const currentProgramDataSelector = selector({
  key: "currentProgramDataSelector",
  get: ({ get }) => {
    const academicData = get(unifiedAcademicDataState);
    if (!academicData.currentProgram || !academicData.programs) {
      return null;
    }
    return academicData.programs[academicData.currentProgram] || null;
  }
});

/**
 * Selector to get all program study plans with local selections merged
 * This replaces both mergedOverviewSelector and mergedScorecardDataSelector
 * by consolidating their identical logic into a single, optimized implementation
 */
export const unifiedStudyPlanSelector = selector({
  key: "unifiedStudyPlanSelector",
  get: ({ get }) => {
    const academicData = get(unifiedAcademicDataState);
    const localSelectedBySemester = get(localSelectedCoursesSemKeyState);

    if (!academicData.programs || Object.keys(academicData.programs).length === 0) {
      return {};
    }

    // Build optimized lookup maps for local selections (O(1) lookups)
    const localSelectedMaps = {};
    for (const [semesterKey, courses] of Object.entries(localSelectedBySemester)) {
      localSelectedMaps[semesterKey] = new Set(courses.map(course => course.id));
    }

    const finalData = {};

    // Process each program
    for (const [programName, programData] of Object.entries(academicData.programs)) {
      if (!programData.studyPlan?.semesterMap) {
        finalData[programName] = {};
        continue;
      }

      finalData[programName] = {};

      // Process each semester in the program
      for (const [semesterKey, semesterData] of Object.entries(programData.studyPlan.semesterMap)) {
        // SIMPLIFIED: Just return the courses from study-plans API directly
        // The original complex logic was causing issues by filtering out study-plans data
        
        // If semesterData is already an array (from study-plans), use it directly
        if (Array.isArray(semesterData)) {
          finalData[programName][semesterKey] = semesterData;
          continue;
        }
        
        // Otherwise, combine completed and planned courses from unified state
        const baseCourses = [
          ...(semesterData.completed || []),
          ...(semesterData.planned || [])
        ];

        // Clone courses (shallow clone is sufficient)
        let processedCourses = baseCourses.map(course => ({ ...course }));

        // PHASE 1: REMOVAL PASS
        // Remove wishlist courses that are no longer in local selections
        processedCourses = processedCourses.filter(course => {
          if (!course.type?.endsWith('-wishlist')) return true;
          
          const localCoursesSet = localSelectedMaps[semesterKey];
          return localCoursesSet && localCoursesSet.has(course.id);
        });

        // PHASE 2: ADDITION PASS
        // Add new locally selected courses that aren't in the unified state yet
        const existingCourseIds = new Set(processedCourses.map(course => course.id));
        const localCourses = localSelectedBySemester[semesterKey] || [];

        for (const localCourse of localCourses) {
          if (!existingCourseIds.has(localCourse.id)) {
            processedCourses.push({
              name: localCourse.shortName || localCourse.id,
              credits: localCourse.credits ? localCourse.credits / 100 : 0,
              type: `${localCourse.classification}-wishlist`,
              grade: null,
              id: localCourse.id,
              big_type: localCourse.big_type,
              calendarEntry: localCourse.calendarEntry || [],
            });
          }
        }

        // PHASE 2.5: SMART EXERCISE GROUP PROCESSING
        // Intelligently handle exercise group credits based on main course existence
        processedCourses = processExerciseGroupECTS(processedCourses);

        // PHASE 3: SORTING PASS
        // Sort by type priority
        const typePriority = {
          'core': 1,
          'elective': 2,
          'contextual': 3
        };

        processedCourses.sort((a, b) => {
          const typeA = a.big_type || '';
          const typeB = b.big_type || '';
          const priorityA = typePriority[typeA] || 999;
          const priorityB = typePriority[typeB] || 999;
          return priorityA - priorityB;
        });

        finalData[programName][semesterKey] = processedCourses;
      }
    }

    return finalData;
  }
});

/**
 * Selector to get the merged transcript for the current program
 * This provides the processed transcript data for the Transcript component
 */
export const currentProgramTranscriptSelector = selector({
  key: "currentProgramTranscriptSelector",
  get: ({ get }) => {
    const currentProgram = get(currentProgramDataSelector);
    if (!currentProgram?.transcript) {
      return null;
    }

    // Return the merged transcript (includes wishlist courses)
    // or fall back to processed transcript if merged is not ready
    return currentProgram.transcript.mergedTranscript || 
           currentProgram.transcript.processedTranscript ||
           currentProgram.transcript.rawScorecard;
  }
});

/**
 * Selector to get the main program (isMainStudy: true)
 * Useful for components that specifically need the main academic program
 */
export const mainProgramSelector = selector({
  key: "mainProgramSelector",
  get: ({ get }) => {
    const academicData = get(unifiedAcademicDataState);
    
    if (!academicData.programs) return null;

    // Find the program marked as main study
    for (const [programName, programData] of Object.entries(academicData.programs)) {
      if (programData.metadata?.isMainStudy) {
        return { programName, ...programData };
      }
    }

    return null;
  }
});

/**
 * Selector to get study plan data for the main program
 * This is the primary selector for StudyOverview component
 */
export const mainProgramStudyPlanSelector = selector({
  key: "mainProgramStudyPlanSelector",
  get: ({ get }) => {
    const mainProgram = get(mainProgramSelector);
    const unifiedStudyPlan = get(unifiedStudyPlanSelector);
    
    if (!mainProgram) return null;

    const programName = mainProgram.programName;
    return unifiedStudyPlan[programName] || {};
  }
});

/**
 * Selector to get academic progress for the current/main program
 * Provides completion metrics and progress tracking
 */
export const academicProgressSelector = selector({
  key: "academicProgressSelector",
  get: ({ get }) => {
    const mainProgram = get(mainProgramSelector);
    
    if (!mainProgram?.studyPlan?.progress) {
      return {
        totalCreditsRequired: 0,
        totalCreditsCompleted: 0,
        totalCreditsPlanned: 0,
        completionPercentage: 0,
        estimatedCompletion: null
      };
    }

    return mainProgram.studyPlan.progress;
  }
});

/**
 * Selector to check if academic data is fully initialized
 * Useful for loading states and conditional rendering
 */
export const academicDataInitializationSelector = selector({
  key: "academicDataInitializationSelector",
  get: ({ get }) => {
    const academicData = get(unifiedAcademicDataState);
    return academicData.initialization;
  }
});

// ============================================================================
// BACKWARD COMPATIBILITY SELECTORS
// These selectors provide the same interface as the deprecated
// unifiedAcademicDataSelector.js for smooth migration
// ============================================================================

/**
 * Selector to check if academic data is loaded
 * Replaces checking academicData.isLoaded from old selector
 */
export const academicDataLoadedSelector = selector({
  key: "academicDataLoadedSelector",
  get: ({ get }) => {
    const academicData = get(unifiedAcademicDataState);
    return academicData.initialization?.isInitialized &&
           Object.keys(academicData.programs || {}).length > 0;
  }
});

/**
 * Selector to get transcript view for all programs
 * Provides the hierarchical structure for transcript display
 */
export const transcriptViewSelector = selector({
  key: "transcriptViewSelector",
  get: ({ get }) => {
    const academicData = get(unifiedAcademicDataState);

    if (!academicData.programs) return {};

    return Object.fromEntries(
      Object.entries(academicData.programs).map(([programId, programData]) => [
        programId,
        programData.transcript?.processedTranscript || {
          programInfo: {},
          hierarchicalStructure: programData.transcript?.rawScorecard?.items || [],
          completedCourses: [],
          plannedCourses: []
        }
      ])
    );
  }
});

/**
 * Selector to get study overview view for all programs
 * Provides semester-based planning view
 * REACTIVE: Dynamically merges current course selections from unifiedCourseDataState
 */
export const studyOverviewViewSelector = selector({
  key: "studyOverviewViewSelector",
  get: ({ get }) => {
    const academicData = get(unifiedAcademicDataState);
    const unifiedCourseData = get(unifiedCourseDataState);

    if (!academicData.programs) return {};

    // Find main program for filtering selections
    const mainProgramId = findMainProgram(
      Object.fromEntries(
        Object.entries(academicData.programs).map(([id, p]) => [
          id,
          { isMainStudy: p.metadata?.isMainStudy }
        ])
      )
    );

    const result = {};

    Object.entries(academicData.programs).forEach(([programId, programData]) => {
      const isMainProgram = programId === mainProgramId;
      const baseSemesterMap = programData.studyPlan?.semesterMap || {};

      // Merge with current course selections from unifiedCourseDataState
      const mergedSemesterMap = {};

      // Get all semesters from both sources
      const allSemesters = new Set([
        ...Object.keys(baseSemesterMap),
        ...Object.keys(unifiedCourseData.semesters || {})
      ]);

      allSemesters.forEach(semesterKey => {
        const baseData = baseSemesterMap[semesterKey] || {
          enrolledCourses: [],
          selectedCourses: [],
          semesterStats: { creditsEarned: 0, coursesCompleted: 0, coursesPlanned: 0, hasActivity: false }
        };

        // Get current selections from unifiedCourseDataState (reactive!)
        const currentSelectedIds = isMainProgram
          ? (unifiedCourseData.semesters?.[semesterKey]?.selectedIds || [])
          : [];
        const currentEnrolledIds = unifiedCourseData.semesters?.[semesterKey]?.enrolledIds || [];

        // Union of selected and enrolled IDs
        const allSelectedIds = Array.from(new Set([...currentSelectedIds, ...currentEnrolledIds]));

        // Get available courses for enrichment
        const availableCourses = getAvailableCoursesWithFallback(
          semesterKey,
          unifiedCourseData.semesters
        );

        // Enrich selected courses with current data
        const enrichedSelectedCourses = allSelectedIds
          .map(courseId => enrichCourseFromAvailable(courseId, availableCourses, {
            enrolledIds: currentEnrolledIds
          }))
          .filter(course => {
            // Filter out courses that are already in enrolledCourses (completed)
            const enrolledCourses = baseData.enrolledCourses || [];
            return !enrolledCourses.some(enrolled =>
              enrolled.courseId === course.courseId ||
              enrolled.id === course.id ||
              enrolled.courseId === course.id
            );
          })
          .map(course => ({
            ...course,
            source: 'planned',
            status: 'planned',
            isCompleted: false,
            isPlanned: true
          }));

        mergedSemesterMap[semesterKey] = {
          enrolledCourses: baseData.enrolledCourses || [],
          selectedCourses: enrichedSelectedCourses,
          semesterStats: {
            creditsEarned: (baseData.enrolledCourses || []).reduce((sum, c) => {
              const credits = parseFloat(c.credits || c.ects || 0);
              return sum + (isNaN(credits) ? 0 : credits);
            }, 0),
            coursesCompleted: (baseData.enrolledCourses || []).length,
            coursesPlanned: enrichedSelectedCourses.length,
            hasActivity: (baseData.enrolledCourses || []).length > 0 || enrichedSelectedCourses.length > 0
          }
        };
      });

      result[programId] = mergedSemesterMap;
    });

    return result;
  }
});

/**
 * Selector to get overall progress across all programs
 */
export const overallProgressSelector = selector({
  key: "overallProgressSelector",
  get: ({ get }) => {
    const academicData = get(unifiedAcademicDataState);

    if (!academicData.programs || Object.keys(academicData.programs).length === 0) {
      return null;
    }

    const stats = {
      totalCreditsEarned: 0,
      totalCreditsRequired: 0,
      totalCoursesCompleted: 0,
      totalCoursesPlanned: 0,
      completionPercentage: 0
    };

    Object.values(academicData.programs).forEach(program => {
      const progress = program.studyPlan?.progress || {};
      stats.totalCreditsEarned += progress.totalCreditsCompleted || 0;
      stats.totalCreditsRequired += progress.totalCreditsRequired || 0;
    });

    stats.completionPercentage = stats.totalCreditsRequired > 0
      ? Math.round((stats.totalCreditsEarned / stats.totalCreditsRequired) * 100)
      : 0;

    return stats;
  }
});

/**
 * Comprehensive selector that provides the same interface as the deprecated
 * unifiedAcademicDataSelector for backward compatibility with existing components
 * REACTIVE: Subscribes to unifiedCourseDataState for dynamic updates
 */
export const legacyAcademicDataSelector = selector({
  key: "legacyAcademicDataSelector",
  get: ({ get }) => {
    const academicData = get(unifiedAcademicDataState);
    const unifiedCourseData = get(unifiedCourseDataState);
    const isLoaded = get(academicDataLoadedSelector);
    const transcriptView = get(transcriptViewSelector);
    const studyOverviewView = get(studyOverviewViewSelector);
    const overallProgress = get(overallProgressSelector);

    if (!isLoaded) {
      return {
        isLoaded: false,
        programs: {},
        hasData: false,
        error: academicData.initialization?.error || null,
        transcriptView: {},
        studyOverviewView: {},
        overallProgress: null
      };
    }

    // Build programs object with expected shape
    const programs = {};
    Object.entries(academicData.programs).forEach(([programId, programData]) => {
      programs[programId] = {
        rawData: programData.transcript?.rawScorecard,
        transcriptView: transcriptView[programId],
        studyOverviewView: studyOverviewView[programId],
        programStats: programData.studyPlan?.progress,
        programId,
        isMainProgram: programData.metadata?.isMainStudy || false,
        programType: programData.metadata?.programType || 'other',
        requirementsFulfilled: programData.metadata?.requirementsFulfilled || {}
      };
    });

    // Calculate total planned courses from current selections
    const totalPlannedCourses = Object.values(unifiedCourseData.semesters || {})
      .reduce((sum, semester) => sum + (semester.selectedIds?.length || 0), 0);

    return {
      isLoaded: true,
      programs,
      hasData: Object.keys(programs).length > 0,
      error: null,
      transcriptView,
      studyOverviewView,
      overallProgress,
      lastFetched: academicData.initialization?.lastInitialized,
      programIds: Object.keys(programs),
      totalPrograms: Object.keys(programs).length,
      planningContext: {
        selectedSemester: unifiedCourseData.selectedSemester,
        availableSemesters: Object.keys(unifiedCourseData.semesters || {}),
        latestValidTerm: unifiedCourseData.latestValidTerm,
        totalPlannedCourses
      }
    };
  }
});