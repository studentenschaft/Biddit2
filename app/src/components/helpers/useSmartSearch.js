/**
 * useSmartSearch
 *
 * Semantic ("smart") course search for the left-column course list. The query
 * orchestration — program derivation, the reference-semester guardrail, and the
 * empty/404 → upsert → retry sequence — is moved here unchanged from the retired
 * SmartSearch tab. All HTTP lives in `similarCoursesApi.js` (kill-switch safe).
 *
 * Results are written to `smartSearchState` as ids + distances; the mapping back
 * to course objects is `smartSearchResultsSelector`.
 */

import { useEffect, useRef, useState } from "react";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { querySimilarCourses, upsertSimilarCourses } from "./similarCoursesApi";
import { useScorecardFetching } from "./useScorecardFetching";
import { authTokenState } from "../recoil/authAtom";
import {
  selectedSemesterSelector,
  availableCoursesSelector,
  semesterMetadataSelector,
} from "../recoil/unifiedCourseDataSelectors";
import { mainProgramSelector } from "../recoil/unifiedAcademicDataSelectors";
import { currentEnrollmentsState } from "../recoil/currentEnrollmentsAtom";
import { unifiedAcademicDataState } from "../recoil/unifiedAcademicDataAtom";
import { smartSearchState } from "../recoil/smartSearchAtom";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

export function useSmartSearch() {
  const authToken = useRecoilValue(authTokenState);
  const scorecardFetching = useScorecardFetching();
  const setSmartSearch = useSetRecoilState(smartSearchState);

  const selectedSemesterShortName = useRecoilValue(selectedSemesterSelector);

  // Use unified semester metadata for future/reference semester handling
  const semesterMetadata = useRecoilValue(
    semesterMetadataSelector(selectedSemesterShortName)
  );
  const isFutureSemesterSelectedSate = semesterMetadata?.isFutureSemester;
  const referenceSemesterState = semesterMetadata?.referenceSemester;
  // True when the displayed courses are borrowed from `referenceSemester`:
  // either a projected future term, or a current-but-sparse term showing a
  // previous-year preview. In BOTH cases the courses do not belong to the
  // selected semester, so queries/upserts must use the reference semester.
  // See REFERENCE_SEMESTER.md. (Historically only isFutureSemester was checked,
  // which silently mislabeled sparse-current previews as the current term and
  // polluted the vector DB — e.g. HS25 courses upserted under "HS26".)
  const usingReferenceData = semesterMetadata?.usingReferenceData;
  const isReferenceData =
    isFutureSemesterSelectedSate || usingReferenceData || false;
  const [referenceSemesterLocalState, setReferenceSemesterLocalState] =
    useState(null);

  // Retrieve available courses for the actual selected semester (not reference)
  const coursesCurrentSemester = useRecoilValue(
    availableCoursesSelector(selectedSemesterShortName)
  );

  // Unified program derivation with fallbacks
  const currentEnrollments = useRecoilValue(currentEnrollmentsState);
  const mainProgram = useRecoilValue(mainProgramSelector);
  const academicData = useRecoilValue(unifiedAcademicDataState);

  const derivedProgram =
    mainProgram?.metadata?.programDescription ||
    mainProgram?.programName ||
    currentEnrollments?.enrollmentInfos?.find((e) => e.isMainStudy)
      ?.studyProgramDescription ||
    (academicData?.programs ? Object.keys(academicData.programs)[0] : null) ||
    null;

  // needed for fetchSimilarCourses to have the most recent program value
  const programRef = useRef(derivedProgram);
  useEffect(() => {
    programRef.current = derivedProgram;
  }, [derivedProgram]);

  // Resolve the semester to use for API calls. When the displayed courses are
  // borrowed (future projection OR current-but-sparse preview), they belong to
  // referenceSemester, so all queries/upserts must use it — not the selected term.
  useEffect(() => {
    try {
      if (isReferenceData) {
        // referenceSemester already stored as shortName
        setReferenceSemesterLocalState(referenceSemesterState || null);
      } else {
        setReferenceSemesterLocalState(null);
      }
    } catch (error) {
      console.error(
        "Error setting reference semester local state in smartSearch:",
        error
      );
      errorHandlingService.handleError(error);
    }
  }, [isReferenceData, referenceSemesterState]);

  // Process course data for upsert. Built on demand rather than in an effect:
  // this hook now lives in the always-mounted left column, and the payload is
  // only needed on the rare empty/404 path.
  function buildRelevantCourseInfoForUpsert() {
    try {
      if (!coursesCurrentSemester) return [];
      return coursesCurrentSemester
        .map((course) => {
          if (!course.courseNumber) {
            console.warn("Missing course number for course:", course);
            return null;
          }
          return {
            courseNumber: course.courseNumber,
            shortName: course.shortName,
            classification: course.classification,
            courseContent: course.courseContent,
          };
        })
        .filter((course) => course !== null);
    } catch (error) {
      console.error(
        "Error building relevant course info for upsert in smartSearch:",
        error
      );
      errorHandlingService.handleError(error);
      return [];
    }
  }

  // upsert relevant course info to backend if no similar courses found.
  // Guardrail + payload live in the shared helper so smart search and
  // SimilarCourses can never drift apart. See REFERENCE_SEMESTER.md.
  async function upsertRelevantCourseInfo() {
    await upsertSimilarCourses({
      authToken,
      courses: buildRelevantCourseInfoForUpsert(),
      program: programRef.current,
      selectedSemester: selectedSemesterShortName,
      referenceSemester: referenceSemesterState,
      isReferenceData,
      source: "SmartSearch",
    });
  }

  // fetch similar courses using the search query
  async function fetchSimilarCourses(
    query,
    category = null,
    attemptedUpsert = false
  ) {
    setSmartSearch((prev) => ({ ...prev, isLoading: true }));

    // Ensure program/scorecard data is available before querying
    if (programRef.current === null) {
      // Try to derive from existing academic data
      const fallbackProgram = academicData?.programs
        ? Object.keys(academicData.programs)[0]
        : null;
      if (fallbackProgram) {
        programRef.current = fallbackProgram;
      } else if (authToken) {
        try {
          const result = await scorecardFetching.fetchAll(authToken);
          const keys = result?.data ? Object.keys(result.data) : [];
          if (keys.length > 0) {
            programRef.current = keys[0];
          }
        } catch (e) {
          console.error("Failed to prefetch scorecard data:", e);
        }
      }
    }

    if (programRef.current !== null) {
      try {
        // Query the semester the displayed courses actually belong to: the
        // reference semester when showing borrowed data (future projection or
        // current-but-sparse preview), otherwise the selected term itself.
        // referenceSemesterLocalState is populated for both borrowed cases.
        const semesterToUse =
          referenceSemesterLocalState || selectedSemesterShortName;
        if (!semesterToUse) {
          console.warn(
            "No semester is selected or available for SmartSearch query"
          );
          setSmartSearch((prev) => ({ ...prev, isLoading: false }));
          return;
        }
        const response = await querySimilarCourses({
          authToken,
          courseDescription: query,
          category,
          program: programRef.current,
          semester: semesterToUse,
        });

        // Only an explicit empty ids list means "queried fine, nothing stored".
        // A body without `ids` (e.g. `{ message }`) is the DB declining to
        // answer and must never trigger a full-catalog upsert.
        const hasIdsList = Boolean(response.data?.ids && response.data.ids[0]);
        const ids = hasIdsList ? response.data.ids[0] : [];
        const distances = response.data?.distances?.[0] ?? [];

        // Empty result on the first attempt: the term's catalog may not be
        // embedded yet, so upsert it (guardrail applies) and query once more.
        if (hasIdsList && ids.length === 0 && !attemptedUpsert) {
          await upsertRelevantCourseInfo();
          await fetchSimilarCourses(query, category, true);
          return;
        }

        setSmartSearch((prev) => ({
          ...prev,
          resultIds: ids,
          distances,
          isLoading: false,
          hasSearched: true,
        }));
      } catch (error) {
        console.error("Error querying database:", error);
        if (error.response && error.response.status === 404) {
          // No similar courses found, attempt upsert if not already done
          if (!attemptedUpsert) {
            await upsertRelevantCourseInfo();
            await fetchSimilarCourses(query, category, true);
            return;
          }
          setSmartSearch((prev) => ({
            ...prev,
            resultIds: [],
            distances: [],
            hasSearched: true,
          }));
        } else {
          errorHandlingService.handleError(error);
        }
        setSmartSearch((prev) => ({ ...prev, isLoading: false }));
      }
    } else {
      console.log("Program not yet loaded; will retry shortly");
      setTimeout(() => {
        fetchSimilarCourses(query, category, attemptedUpsert);
      }, 800);
    }
  }

  /**
   * Run a semantic search for `query` against the selected semester.
   * Empty queries are ignored, matching the retired tab's behaviour.
   */
  const runSearch = async (query) => {
    const trimmedQuery = (query || "").trim();
    if (!trimmedQuery) return;

    setSmartSearch((prev) => ({
      ...prev,
      query: trimmedQuery,
      isLoading: true,
      hasSearched: true,
    }));

    await fetchSimilarCourses(trimmedQuery);
  };

  return { runSearch };
}

export default useSmartSearch;
