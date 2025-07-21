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
          const builtTermListObject = sortedTerms
            .map((shortName) => {
              const termData = termIdList.find(
                (t) => t.shortName === shortName
              );
              if (!termData) return null;

              // Determine if this is a projected future semester
              const isProjected = latestValidTerm
                ? sortedTerms.indexOf(shortName) >
                  sortedTerms.indexOf(latestValidTerm)
                : false;

              return {
                cisId: termData.cisId, // actual CIS ID for CourseInformationSheets API
                id: termData.id, // timeSegmentId for MyCourses API
                shortName: termData.shortName,
                isCurrent: termData.isCurrent || false,
                isProjected: isProjected,
              };
            })
            .filter(Boolean);

          setTermListObject(builtTermListObject);

          // Set the selected semester to the latest valid term
          if (latestValidTerm) {
            setUnifiedSelectedSemester(
              latestValidTerm,
              termIdList,
              latestValidTerm
            );
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
