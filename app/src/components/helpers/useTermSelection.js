import { useEffect, useState, useRef } from "react";
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import { apiClient } from "./axiosClient";
import { termsUrl } from "./apiEndpoints";
import { authTokenState } from "../recoil/authAtom";
import { cisIdList } from "../recoil/cisIdListAtom";
import { cisIdListSelector } from "../recoil/cisIdListSelector";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
import { useUnifiedCourseDataWriters } from "./useUnifiedCourseDataWriters";
import { useUnifiedSemesterState } from "./useUnifiedSemesterState";
import { termListState } from "../recoil/termListState";
import {
  currentSemesterKey,
  nextSemesterKey,
  previousYearSameSeason,
  sortSemesterKeys,
} from "../../domain/semester";
import { log } from "./log";

/**
 * SIMPLIFIED Custom hook to handle term selection logic
 *
 * Returns:
 * - isLoading: boolean indicating if data is still being fetched
 * - termListObject: Array of semester objects ordered by semester shortName
 *   Each object contains: { cisId, shortName, isCurrent, isProjected }
 *
 * REMOVED DEPENDENCIES:
 * - useUpdateEnrolledCoursesAtom (replaced with unified course data)
 * - localSelectedCoursesSemKeyState (replaced with unified selected courses)
 * - Index-based legacy systems (replaced with semantic semester names)
 */
export function useTermSelection() {
  const authToken = useRecoilValue(authTokenState);
  const [cisIdListAtom, setCisIdList] = useRecoilState(cisIdList);
  const termIdList = useRecoilValue(cisIdListSelector);

  // Local state - simplified
  const [isLoading, setIsLoading] = useState(true);
  const [termListObject, setTermListObject] = useState([]);
  const setTermListAtom = useSetRecoilState(termListState);
  const initialSelectionMadeRef = useRef(false);

  // Unified course data hooks
  const { initializeSemester: initializeUnifiedSemester } =
    useUnifiedCourseDataWriters();

  // Unified semester state hook
  const {
    courseData,
    setSelectedSemester: setUnifiedSelectedSemester,
    setLatestValidTerm: setUnifiedLatestValidTerm,
  } = useUnifiedSemesterState();

  // Generate future semesters helper function
  const generateFutureSemesters = (latestSemester, allApiTerms, count = 2) => {
    if (!latestSemester || !allApiTerms) return [];

    const futureSemesters = [];
    let futureShortName = latestSemester;

    for (let i = 0; i < count; i++) {
      futureShortName = nextSemesterKey(futureShortName);
      const season = futureShortName.slice(0, 2);

      // SAME-SEASON PREVIOUS-YEAR RULE for reference
      const referenceSemesterName = previousYearSameSeason(futureShortName);

      // Look for the same-season previous-year in API data
      const referenceTerm = allApiTerms.find(
        (term) => term.shortName === referenceSemesterName
      );

      // If we don't have the same-season previous year, attempt fallback: year-1 opposite season, else last API term
      let referenceCisId = referenceTerm?.cisId;
      if (!referenceCisId) {
        const fallbackOppositeSeason = previousYearSameSeason(
          `${season === "FS" ? "HS" : "FS"}${futureShortName.slice(2)}`
        );
        const fallbackTerm = allApiTerms.find(
          (t) => t.shortName === fallbackOppositeSeason
        );
        referenceCisId =
          fallbackTerm?.cisId || allApiTerms[allApiTerms.length - 1]?.cisId;
      }

      futureSemesters.push({
        cisId: referenceCisId, // Use the reference semester's cisId
        id: `future-${futureShortName}`, // Generate a unique ID for future semesters
        shortName: futureShortName,
        referenceSemester: referenceSemesterName, // Track same-season previous-year reference
        isCurrent: false,
        isProjected: true,
        isFuture: true, // Mark as artificially generated future semester
      });
    }

    return futureSemesters;
  };

  // 1. Load cisIdList data
  useEffect(() => {
    if (authToken && !cisIdListAtom) {
      (async () => {
        try {
          setIsLoading(true);
          const response = await apiClient.get(termsUrl(), authToken, {
            headers: { "X-RequestedLanguage": "DE" },
            suppressErrorToast: true,
          });
          setCisIdList(response.data);
          log.debug("✅ [TERM SELECTION] CIS ID list loaded:", response.data);
        } catch (error) {
          console.error("[CisIdList] Error fetching data:", error);
          errorHandlingService.handleError(error);
          setIsLoading(false);
        }
      })();
    }
  }, [authToken, cisIdListAtom, setCisIdList]);

  // 2. Build termListObject and find latest valid term
  useEffect(() => {
    if (authToken && termIdList?.length && !initialSelectionMadeRef.current) {
      initialSelectionMadeRef.current = true;

      (async () => {
        try {
          setIsLoading(true);
          log.debug("🔄 [TERM SELECTION] Building term list object...");

          // Initialize all semesters in unified data
          termIdList.forEach((term) => {
            initializeUnifiedSemester(term.shortName, {
              id: term.id, // timeSegmentId for MyCourses API
              cisId: term.cisId, // actual CIS ID for CourseInformationSheets API
              isCurrent: term.isCurrent || false,
              isProjected: false, // Will be determined later for future semesters
            });
          });

          const currentTerms = termIdList.filter((term) => term.isCurrent);
          let primaryTermShortName = null;

          // Prefer calendar-based semester, fall back to API's isCurrent flag
          const currentSemKey = currentSemesterKey();
          const calendarTerm = termIdList.find(
            (t) => t.shortName === currentSemKey
          );

          if (calendarTerm) {
            primaryTermShortName = calendarTerm.shortName;
            log.debug(
              "✅ [TERM SELECTION] Using calendar-based current term:",
              primaryTermShortName
            );
          } else {
            primaryTermShortName =
              currentTerms.length > 0
                ? currentTerms[0].shortName
                : termIdList[0]?.shortName;
            log.debug(
              "⚠️ [TERM SELECTION] Calendar semester not in API list, falling back to:",
              primaryTermShortName
            );
          }

          // The enrolments for this term are loaded by useEnrolledCoursesData.
          if (primaryTermShortName) {
            setUnifiedLatestValidTerm(primaryTermShortName);
          }

          // Build the final termListObject with proper ordering and metadata
          const sortedTerms = sortSemesterKeys(termIdList.map((t) => t.shortName));

          // Calculate how many artificial future semesters we need to generate
          // We want to ensure we always have at least 2 future semesters beyond the latest valid term
          const futureSemestersNeeded = Math.max(
            0,
            2 -
              (sortedTerms.length -
                sortedTerms.indexOf(primaryTermShortName || sortedTerms[0]) -
                1)
          );

          let artificialFutureSemesters = [];
          if (futureSemestersNeeded > 0) {
            // Find the latest semester from API data to use as reference for artificial ones
            const latestApiSemester = sortedTerms[sortedTerms.length - 1];

            // Generate artificial future semesters only if needed
            // Pass the full termIdList so the function can find proper reference semesters
            artificialFutureSemesters = generateFutureSemesters(
              latestApiSemester,
              termIdList,
              futureSemestersNeeded
            );

            // Initialize artificial future semesters in unified data
            artificialFutureSemesters.forEach((futureSemester) => {
              initializeUnifiedSemester(futureSemester.shortName, {
                id: futureSemester.id,
                cisId: futureSemester.cisId,
                isCurrent: false,
                isProjected: true, // Mark as artificially generated
                isFuture: true,
                referenceSemester: futureSemester.referenceSemester, // Store reference semester info
              });
            });
          }

          // Combine API terms with artificial future semesters and sort again
          const allTerms = [...termIdList, ...artificialFutureSemesters];
          const allSortedTerms = sortSemesterKeys(allTerms.map((t) => t.shortName));

          // Resolve a reference term's cisId. The dropdown only keeps the 3 most
          // recent terms (allTerms), but a reference like FS25 for FS26 can be
          // older and still fetchable — so fall back to the full raw term list.
          const resolveReferenceCisId = (name) => {
            const inWindow = allTerms.find((t) => t.shortName === name);
            if (inWindow?.cisId) return inWindow.cisId;
            const raw = (cisIdListAtom || []).find(
              (t) => t.shortName === name
            );
            return raw?.id || null;
          };

          const builtTermListObject = allSortedTerms
            .map((shortName) => {
              const termData = allTerms.find((t) => t.shortName === shortName);
              if (!termData) return null;

              // Relative to the calendar-based current term, not the API's
              // isCurrent flag: the API may mark a future term as "current"
              // before courses are published.
              const isFuture = primaryTermShortName
                ? allSortedTerms.indexOf(shortName) >
                  allSortedTerms.indexOf(primaryTermShortName)
                : false;

              // Same-season previous year as reference (e.g. HS26 -> HS25).
              // Computed for every semester (not only future ones) so the course
              // list can preview last year's catalog whenever a term isn't yet
              // published or its own catalog errors — including the current term.
              let referenceSemester = termData.referenceSemester || null;
              let referenceCisId = null;
              if (!referenceSemester) {
                const refName = previousYearSameSeason(shortName);
                const cisId = refName && resolveReferenceCisId(refName);
                if (cisId) {
                  referenceSemester = refName;
                  referenceCisId = cisId;
                }
              } else {
                referenceCisId = resolveReferenceCisId(referenceSemester);
              }

              // isProjected = artificially generated (not from API)
              // isFuture = newer than current semester (could be real API data or artificial)
              return {
                cisId: termData.cisId, // real CIS ID for API terms, reference cisId for artificial ones
                id: termData.id, // real timeSegmentId for API terms, generated ID for artificial ones
                shortName: termData.shortName,
                isCurrent: termData.isCurrent || false,
                isProjected: termData.isFuture || false, // Only artificial semesters are "projected"
                isFuture: isFuture, // Any semester newer than current semester
                referenceSemester,
                referenceCisId,
              };
            })
            .filter(Boolean);

          setTermListObject(builtTermListObject);
          setTermListAtom(builtTermListObject);

          // Set the selected semester to the latest valid term only if no semester is currently selected
          // This prevents overriding the user's existing semester selection when StudyOverview opens
            if (!courseData.selectedSemester && primaryTermShortName) {
            setUnifiedSelectedSemester(primaryTermShortName, termIdList, primaryTermShortName);
            }

          log.debug(
            "✅ [TERM SELECTION] Term list object built:",
            builtTermListObject
          );
          setIsLoading(false);
        } catch (error) {
          console.error("[TERM SELECTION] Error building term list:", error);
          errorHandlingService.handleError(error);
          setIsLoading(false);
        }
      })();
    }
    // Intentionally runs once (guarded by initialSelectionMadeRef); cisIdListAtom
    // and the Recoil setters are stable for the lifetime of this build.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authToken,
    termIdList,
    initializeUnifiedSemester,
    setUnifiedLatestValidTerm,
    setUnifiedSelectedSemester,
    courseData.selectedSemester,
  ]);

  return {
    isLoading,
    termListObject,
  };
}
