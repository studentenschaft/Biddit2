import {
  findMainProgram,
  buildTranscriptView,
  buildStudyOverviewView,
  calculateProgramStats,
} from "./academicDataTransformers";

/**
 * Builds the per-programme academic data map from raw scorecards.
 *
 * @param {Object} params
 * @param {Object} params.rawScorecards - { programId: raw scorecard from the university API }
 * @param {Object} params.mainStudyLookup - { programId: boolean } from buildMainStudyLookup
 * @param {Object} params.unifiedCourseData - unifiedCourseDataState value (for wishlisted courses)
 * @returns {{ programs: Object, currentProgram: string|null }}
 */
export const buildAcademicPrograms = ({
  rawScorecards,
  mainStudyLookup,
  unifiedCourseData,
}) => {
  const mainProgramId = findMainProgram(rawScorecards, mainStudyLookup);
  const programs = {};

  Object.entries(rawScorecards).forEach(([programId, rawData]) => {
    const isMainProgram = programId === mainProgramId;
    const transcriptView = buildTranscriptView(rawData);
    const studyOverviewView = buildStudyOverviewView(
      rawData,
      unifiedCourseData,
      programId,
      isMainProgram
    );

    const programStats = calculateProgramStats(
      transcriptView.completedCourses,
      Object.values(studyOverviewView).flatMap(s => s.selectedCourses || []),
      rawData
    );

    programs[programId] = {
      transcript: {
        rawScorecard: rawData,
        processedTranscript: transcriptView,
        mergedTranscript: null,
        lastFetched: Date.now()
      },
      studyPlan: {
        semesterMap: studyOverviewView,
        progress: {
          totalCreditsRequired: programStats.creditsRequired,
          totalCreditsCompleted: programStats.creditsEarned,
          totalCreditsPlanned: 0,
          completionPercentage: programStats.completionPercentage,
          estimatedCompletion: null
        },
        lastUpdated: Date.now()
      },
      metadata: {
        programId,
        isMainStudy: isMainProgram,
        programType: programId.toLowerCase().includes('master') ? 'master' :
                     programId.toLowerCase().includes('bachelor') ? 'bachelor' : 'other',
        requirementsFulfilled: {
          creditsDE: rawData.creditsFulfilledDe === true,
          creditsEN: rawData.creditsFulfilledEn === true,
          overall: rawData.creditsFulfilledDe === true && rawData.creditsFulfilledEn === true
        }
      }
    };
  });

  return { programs, currentProgram: mainProgramId };
};
