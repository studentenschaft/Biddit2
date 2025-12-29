import { useCallback } from "react";
import {
  useRecoilState,
  useRecoilValue,
  useSetRecoilState,
} from "recoil";

import { scorecardDataState } from "../recoil/scorecardsAllRawAtom";
import { unifiedAcademicDataState } from "../recoil/unifiedAcademicDataAtom";
import { unifiedCourseDataState } from "../recoil/unifiedCourseDataAtom";
import { currentEnrollmentsState } from "../recoil/currentEnrollmentsAtom";
import { fetchCurrentEnrollments } from "../recoil/ApiCurrentEnrollments";
import { fetchScoreCardDetails } from "../recoil/ApiScorecardDetails";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
import {
  findMainProgram,
  buildTranscriptView,
  buildStudyOverviewView,
  calculateProgramStats
} from "./academicDataTransformers";

const resolveProgramId = (enrollment) =>
  enrollment.studyProgramDescription ||
  enrollment.programName ||
  enrollment.studyRegulationId;

/**
 * Hook that exposes a single `fetchAll` method to populate scorecard data.
 * Consumers can call it when they need scorecard information; the hook
 * caches results in Recoil and prevents duplicate network calls.
 */
export const useScorecardFetching = () => {
  const [scorecardState, setScorecardState] = useRecoilState(scorecardDataState);
  const setUnifiedAcademicData = useSetRecoilState(unifiedAcademicDataState);
  const unifiedCourseData = useRecoilValue(unifiedCourseDataState);
  const currentEnrollments = useRecoilValue(currentEnrollmentsState);
  const setCurrentEnrollments = useSetRecoilState(currentEnrollmentsState);

  const fetchAll = useCallback(
    async (authToken, { force = false } = {}) => {
      if (!authToken) {
        throw new Error("Cannot fetch scorecard data without an auth token.");
      }

      if (scorecardState.loading && !force) {
        return {
          success: true,
          data: scorecardState.rawScorecards,
          loading: true,
        };
      }

      if (scorecardState.isLoaded && !force) {
        return { success: true, data: scorecardState.rawScorecards };
      }

      setScorecardState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        let enrollmentsPayload = currentEnrollments;
        if (!enrollmentsPayload?.enrollmentInfos?.length || force) {
          enrollmentsPayload = await fetchCurrentEnrollments(authToken);
          if (enrollmentsPayload) {
            setCurrentEnrollments(enrollmentsPayload);
          }
        }

        const enrollmentInfos = enrollmentsPayload?.enrollmentInfos || [];
        if (enrollmentInfos.length === 0) {
          throw new Error("No enrollment information available.");
        }

        const results = await Promise.all(
          enrollmentInfos.map(async (enrollment) => {
            const attempt = enrollment.attempt || 1;
            try {
              const response = await fetchScoreCardDetails(
                authToken,
                enrollment.studyRegulationId,
                attempt
              );
              return {
                programId: resolveProgramId(enrollment),
                success: response?.success,
                data: response?.data,
                error: response?.error,
              };
            } catch (error) {
              return {
                programId: resolveProgramId(enrollment),
                success: false,
                error: error.message,
              };
            }
          })
        );

        const rawScorecards = {};
        const errors = [];

        results.forEach(({ programId, success, data, error }) => {
          if (success && data && programId) {
            rawScorecards[programId] = data;
          } else if (programId) {
            errors.push(`${programId}: ${error || "unknown error"}`);
          }
        });

        // LEGACY: Keep scorecardDataState populated for backward compatibility
        setScorecardState({
          rawScorecards,
          isLoaded: Object.keys(rawScorecards).length > 0,
          loading: false,
          error: errors.length ? errors.join("; ") : null,
          lastFetched: new Date().toISOString(),
        });

        // NEW: Transform and store in unified academic data state
        if (Object.keys(rawScorecards).length > 0) {
          const mainProgramId = findMainProgram(rawScorecards);
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
                isMainStudy: rawData.isMainStudy || isMainProgram,
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

          setUnifiedAcademicData({
            programs,
            currentProgram: mainProgramId,
            initialization: {
              isLoading: false,
              isInitialized: true,
              error: errors.length ? errors.join("; ") : null,
              lastInitialized: Date.now()
            }
          });
        }

        return {
          success: true,
          data: rawScorecards,
          errors,
        };
      } catch (error) {
        console.error("Failed to fetch scorecard data:", error);
        errorHandlingService.handleError(error);
        setScorecardState((prev) => ({
          ...prev,
          loading: false,
          error: error.message || "Failed to load scorecard data",
        }));
        return { success: false, error: error.message };
      }
    },
    [
      currentEnrollments,
      scorecardState.isLoaded,
      scorecardState.loading,
      scorecardState.rawScorecards,
      setCurrentEnrollments,
      setScorecardState,
      setUnifiedAcademicData,
      unifiedCourseData,
    ]
  );

  return {
    fetchAll,
    isLoaded: scorecardState.isLoaded,
    loading: scorecardState.loading,
    lastFetched: scorecardState.lastFetched,
    error: scorecardState.error,
  };
};

export default useScorecardFetching;
