import { useEffect, useState, useRef } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import axios from "axios";
import { authTokenState } from "../recoil/authAtom";
import { cisIdList } from "../recoil/cisIdListAtom";
import { cisIdListSelector } from "../recoil/cisIdListSelector";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
import { useUnifiedCourseData } from "./useUnifiedCourseData";
import { useUnifiedSemesterState } from "./useUnifiedSemesterState";

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
  const initialSelectionMadeRef = useRef(false);

  // Unified course data hooks
  const {
    updateEnrolledCourses: updateUnifiedEnrolledCourses,
    initializeSemester: initializeUnifiedSemester,
  } = useUnifiedCourseData();

  // Unified semester state hook
  const {
    courseData,
    setSelectedSemester: setUnifiedSelectedSemester,
    setLatestValidTerm: setUnifiedLatestValidTerm,
  } = useUnifiedSemesterState();

  // Sort terms helper function
  const sortTerms = (terms) => {
    return [...terms].sort((a, b) => {
      const [seasonA, yearA] = [a.slice(0, 2), parseInt(a.slice(2), 10)];
      const [seasonB, yearB] = [b.slice(0, 2), parseInt(b.slice(2), 10)];
      return yearA !== yearB
        ? yearA - yearB
        : seasonA === "FS" && seasonB === "HS"
        ? -1
        : seasonA === "HS" && seasonB === "FS"
        ? 1
        : 0;
    });
  };

  // Generate future semesters helper function
  const generateFutureSemesters = (latestSemester, allApiTerms, count = 2) => {
    if (!latestSemester || !allApiTerms) return [];

    const futureSemesters = [];
    const [season, yearStr] = [
      latestSemester.slice(0, 2),
      latestSemester.slice(2),
    ];
    let currentYear = parseInt(yearStr, 10);
    let currentSeason = season;

    for (let i = 0; i < count; i++) {
      // Calculate next semester
      if (currentSeason === "FS") {
        currentSeason = "HS";
      } else {
        currentSeason = "FS";
        currentYear += 1;
      }

      const futureShortName = `${currentSeason}${currentYear
        .toString()
        .slice(-2)}`;

      // SAME-SEASON PREVIOUS-YEAR RULE for reference
      const referenceSemesterName = `${currentSeason}${(currentYear - 1)
        .toString()
        .slice(-2)}`;

      // Look for the same-season previous-year in API data
      const referenceTerm = allApiTerms.find(
        (term) => term.shortName === referenceSemesterName
      );

      // If we don't have the same-season previous year, attempt fallback: year-1 opposite season, else last API term
      let referenceCisId = referenceTerm?.cisId;
      if (!referenceCisId) {
        const fallbackOppositeSeason = `${
          currentSeason === "FS" ? "HS" : "FS"
        }${(currentYear - 1).toString().slice(-2)}`;
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
          const response = await axios.get(
            `https://integration.unisg.ch/EventApi/CisTermAndPhaseInformations`,
            {
              headers: {
                "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
                "X-RequestedLanguage": "DE",
                "API-Version": "1",
                Authorization: `Bearer ${authToken}`,
              },
            }
          );
          setCisIdList(response.data);
          console.log("✅ [TERM SELECTION] CIS ID list loaded:", response.data);
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
          console.log("🔄 [TERM SELECTION] Building term list object...");

          // Initialize all semesters in unified data
          termIdList.forEach((term) => {
            initializeUnifiedSemester(term.shortName, {
              id: term.id, // timeSegmentId for MyCourses API
              cisId: term.cisId, // actual CIS ID for CourseInformationSheets API
              isCurrent: term.isCurrent || false,
              isProjected: false, // Will be determined later for future semesters
            });
          });

          // Find current terms from API
          const currentTerms = termIdList.filter((term) => term.isCurrent);
          let latestValidTerm = null;
          let primaryTermShortName = null;

          if (currentTerms.length > 0) {
            primaryTermShortName = currentTerms[0].shortName;
            console.log(
              "✅ [TERM SELECTION] Using API-marked current term:",
              primaryTermShortName
            );
          } else {
            primaryTermShortName = termIdList[0]?.shortName;
            console.log(
              "⚠️ [TERM SELECTION] No current terms found, using first term:",
              primaryTermShortName
            );
          }

          // Try to fetch enrolled courses to validate the term
          if (primaryTermShortName) {
            const primaryTerm = termIdList.find(
              (t) => t.shortName === primaryTermShortName
            );
            try {
              const response = await axios.get(
                `https://integration.unisg.ch/EventApi/MyCourses/byTerm/${primaryTerm.id}`,
                {
                  headers: {
                    "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
                    "X-RequestedLanguage": "DE",
                    "API-Version": "1",
                    Authorization: `Bearer ${authToken}`,
                  },
                }
              );

              // Update unified course data
              updateUnifiedEnrolledCourses(primaryTermShortName, response.data);
              latestValidTerm = primaryTermShortName;
              setUnifiedLatestValidTerm(primaryTermShortName);

              console.log(
                "✅ [TERM SELECTION] Latest valid term:",
                latestValidTerm
              );
            } catch (error) {
              console.error(
                "[TERM SELECTION] Error fetching courses for primary term:",
                error
              );
              // Still set it as latest valid term even if no courses
              latestValidTerm = primaryTermShortName;
              setUnifiedLatestValidTerm(primaryTermShortName);
            }
          }

          // Build the final termListObject with proper ordering and metadata
          const sortedTerms = sortTerms(termIdList.map((t) => t.shortName));

          // Calculate how many artificial future semesters we need to generate
          // We want to ensure we always have at least 2 future semesters beyond the latest valid term
          const futureSemestersNeeded = Math.max(
            0,
            2 -
              (sortedTerms.length -
                sortedTerms.indexOf(latestValidTerm || sortedTerms[0]) -
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
          const allSortedTerms = sortTerms(allTerms.map((t) => t.shortName));

          const builtTermListObject = allSortedTerms
            .map((shortName) => {
              const termData = allTerms.find((t) => t.shortName === shortName);
              if (!termData) return null;

              // Find the current semester as marked by the API
              const currentSemester =
                currentTerms.length > 0 ? currentTerms[0].shortName : null;

              // Determine if this is a future semester (newer than current semester)
              const isFuture = currentSemester
                ? allSortedTerms.indexOf(shortName) >
                  allSortedTerms.indexOf(currentSemester)
                : false;

              // isProjected = artificially generated (not from API)
              // isFuture = newer than current semester (could be real API data or artificial)
              return {
                cisId: termData.cisId, // real CIS ID for API terms, reference cisId for artificial ones
                id: termData.id, // real timeSegmentId for API terms, generated ID for artificial ones
                shortName: termData.shortName,
                isCurrent: termData.isCurrent || false,
                isProjected: termData.isFuture || false, // Only artificial semesters are "projected"
                isFuture: isFuture, // Any semester newer than current semester
              };
            })
            .filter(Boolean);

          setTermListObject(builtTermListObject);

          // Set the selected semester to the latest valid term only if no semester is currently selected
          // This prevents overriding the user's existing semester selection when StudyOverview opens
            if (!courseData.selectedSemester && latestValidTerm) {
            setUnifiedSelectedSemester(latestValidTerm, termIdList, latestValidTerm);
            }

          console.log(
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
  }, [
    authToken,
    termIdList,
    initializeUnifiedSemester,
    updateUnifiedEnrolledCourses,
    setUnifiedLatestValidTerm,
    setUnifiedSelectedSemester,
  ]);

  return {
    isLoading,
    termListObject,
  };
}
