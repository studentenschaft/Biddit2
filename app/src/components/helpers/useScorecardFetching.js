import { useCallback } from "react";
import {
  useRecoilState,
  useRecoilValue,
  useSetRecoilState,
} from "recoil";

import { scorecardDataState } from "../recoil/scorecardsAllRawAtom";
import { currentEnrollmentsState } from "../recoil/currentEnrollmentsAtom";
import { fetchCurrentEnrollments } from "../recoil/ApiCurrentEnrollments";
import { fetchScoreCardDetails } from "../recoil/ApiScorecardDetails";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

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

        setScorecardState({
          rawScorecards,
          isLoaded: Object.keys(rawScorecards).length > 0,
          loading: false,
          error: errors.length ? errors.join("; ") : null,
          lastFetched: new Date().toISOString(),
        });

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
