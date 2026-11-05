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
  buildMainStudyLookup,
  resolveProgramId,
} from "./academicDataTransformers";
import { buildAcademicPrograms } from "./buildAcademicPrograms";

// Shared by every hook instance: consumers that mount in the same commit all
// read `loading: false` from their render snapshot, so Recoil state alone
// cannot stop them from starting parallel fetches.
let inFlightFetch = null;

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

  const loadScorecards = useCallback(
    async (authToken, force) => {
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

        // Authoritative main-study flag lives on the enrollments API, not on the
        // scorecard details. Capture it before scorecards are fetched so program
        // selection never falls back to name-based heuristics.
        const mainStudyLookup = buildMainStudyLookup(enrollmentInfos);

        const results = await Promise.all(
          enrollmentInfos.map(async (enrollment) => {
            const attempt = enrollment.attempt || 1;
            try {
              const data = await fetchScoreCardDetails(
                authToken,
                enrollment.studyRegulationId,
                attempt
              );
              return { programId: resolveProgramId(enrollment), data };
            } catch (error) {
              return {
                programId: resolveProgramId(enrollment),
                error: error.message,
                cause: error,
              };
            }
          })
        );

        const rawScorecards = {};
        const errors = [];
        let firstCause;

        results.forEach(({ programId, data, error, cause }) => {
          if (data && programId) {
            rawScorecards[programId] = data;
          } else if (programId) {
            errors.push(`${programId}: ${error || "unknown error"}`);
            firstCause ??= cause;
          }
        });

        // One report per fetch, however many programmes failed.
        if (errors.length > 0) {
          errorHandlingService.handleError(firstCause || new Error(errors[0]));
        }

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
          const { programs, currentProgram } = buildAcademicPrograms({
            rawScorecards,
            mainStudyLookup,
            unifiedCourseData,
          });

          setUnifiedAcademicData({
            programs,
            currentProgram,
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
      setCurrentEnrollments,
      setScorecardState,
      setUnifiedAcademicData,
      unifiedCourseData,
    ]
  );

  const fetchAll = useCallback(
    async (authToken, { force = false } = {}) => {
      if (!authToken) {
        throw new Error("Cannot fetch scorecard data without an auth token.");
      }

      if (inFlightFetch && !force) {
        return inFlightFetch;
      }

      if (scorecardState.isLoaded && !force) {
        return { success: true, data: scorecardState.rawScorecards };
      }

      const request = loadScorecards(authToken, force);
      inFlightFetch = request;
      request.finally(() => {
        if (inFlightFetch === request) inFlightFetch = null;
      });
      return request;
    },
    [
      loadScorecards,
      scorecardState.isLoaded,
      scorecardState.rawScorecards,
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
