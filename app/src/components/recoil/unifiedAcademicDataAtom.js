import { atom } from "recoil";

/**
 * Unified academic data atom that stores all transcript, study plan, and progress information
 * This replaces the fragmented approach of multiple scorecard atoms and selectors
 *
 * Structure:
 * {
 *   programs: {
 *     "Bachelor in Information Systems": {
 *       transcript: {
 *         // Raw scorecard data from university API
 *         rawScorecard: {},
 *         // Processed transcript with categories and courses
 *         processedTranscript: {},
 *         // Wishlist courses merged into transcript format
 *         mergedTranscript: {},
 *         lastFetched: null
 *       },
 *       studyPlan: {
 *         // Courses organized by semester for study overview
 *         semesterMap: {
 *           "HS24": {
 *             completed: [], // Courses with grades
 *             planned: [], // Wishlisted courses
 *             enrolled: [], // Currently enrolled
 *             credits: { completed: 30, planned: 12, total: 42 }
 *           }
 *         },
 *         progress: {
 *           totalCreditsRequired: 180,
 *           totalCreditsCompleted: 120,
 *           totalCreditsPlanned: 30,
 *           completionPercentage: 66.7,
 *           estimatedCompletion: "FS26"
 *         },
 *         lastUpdated: null
 *       },
 *       metadata: {
 *         programId: "BIS2021",
 *         programDescription: "Bachelor in Information Systems",
 *         isMainStudy: true,
 *         studyRegulationId: "12345",
 *         attempt: 1
 *       }
 *     }
 *   },
 *   currentProgram: null, // Currently selected program
 *   initialization: {
 *     isLoading: false,
 *     isInitialized: false,
 *     error: null,
 *     lastInitialized: null
 *   }
 * }
 */

export const unifiedAcademicDataState = atom({
  key: "unifiedAcademicDataState",
  default: {
    programs: {},
    currentProgram: null,
    initialization: {
      isLoading: false,
      isInitialized: false,
      error: null,
      lastInitialized: null
    }
  }
});

/**
 * Atom to track which programs have been fully initialized
 * This helps avoid unnecessary re-fetching and processing
 */
export const initializedProgramsState = atom({
  key: "initializedProgramsState",
  default: new Set()
});