import { selector } from "recoil";
import { unifiedAcademicDataState } from "./unifiedAcademicDataAtom";
import { localSelectedCoursesSemKeyState } from "./localSelectedCoursesSemKeyAtom";
import { exerciseGroupRegex } from "../helpers/regEx";

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

        // PHASE 2.5: EXERCISE GROUP PROCESSING
        // Remove credits for exercise groups
        processedCourses = processedCourses.map(course => {
          if (course.name && course.name.match(exerciseGroupRegex)) {
            return { ...course, credits: 0 };
          }
          return course;
        });

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