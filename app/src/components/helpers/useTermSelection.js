import { useEffect, useState, useRef } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import axios from "axios";
import { authTokenState } from "../recoil/authAtom";
import { cisIdList } from "../recoil/cisIdListAtom";
import { cisIdListSelector } from "../recoil/cisIdListSelector";
import { latestValidTermAtom } from "../recoil/latestValidTermAtom";
import { enrolledCoursesState } from "../recoil/enrolledCoursesAtom";
import { courseInfoState } from "../recoil/courseInfoAtom";
import { latestValidTermProjectionState } from "../recoil/latestValidTermProjection";
import {
  selectedSemesterAtom,
  selectedSemesterIndexAtom,
} from "../recoil/selectedSemesterAtom";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
import { useUpdateEnrolledCoursesAtom } from "../helpers/useUpdateEnrolledCourses";
import { referenceSemesterAtom } from "../recoil/referenceSemesterAtom";
import { useUnifiedCourseData } from "./useUnifiedCourseData";
import { useUnifiedSemesterState } from "./useUnifiedSemesterState";

/**
 * Custom hook to handle term selection logic including:
 * - Loading CIS ID list
 * - Determining latest valid term
 * - Setting up term projections for future semesters
 * - Managing semester selection state
 */
export function useTermSelection() {
  const authToken = useRecoilValue(authTokenState);
  const [cisIdListAtom, setCisIdList] = useRecoilState(cisIdList);
  const termIdList = useRecoilValue(cisIdListSelector);
  const [latestValidTerm, setLatestValidTerm] =
    useRecoilState(latestValidTermAtom);
  const enrolledCourses = useRecoilValue(enrolledCoursesState);
  const [, setSelectedIndex] = useRecoilState(selectedSemesterIndexAtom);
  const [, setSelectedSemesterState] = useRecoilState(selectedSemesterAtom);
  const [, setReferenceSemester] = useRecoilState(referenceSemesterAtom);

  // Local state
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSem, setSelectedSemester] = useState(
    "loading semester data..."
  );
  const initialSelectionMadeRef = useRef(false);
  // Helpers
  const updateEnrolledCourses = useUpdateEnrolledCoursesAtom();
  // New unified course data hook
  const {
    updateEnrolledCourses: updateUnifiedEnrolledCourses,
    initializeSemester: initializeUnifiedSemester,
  } = useUnifiedCourseData();

  // New unified semester state hook
  const {
    setSelectedSemester: setUnifiedSelectedSemester,
    setLatestValidTerm: setUnifiedLatestValidTerm,
    setFutureSemesterStatus: setUnifiedFutureSemesterStatus,
  } = useUnifiedSemesterState();

  // For future semesters
  const courseInfo = useRecoilValue(courseInfoState);
  const [, setLatestValidTermProjection] = useRecoilState(
    latestValidTermProjectionState
  );

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
        } catch (error) {
          console.error("[CisIdList] Error fetching data:", error);
          errorHandlingService.handleError(error);
        }
      })();
    }
  }, [authToken, setCisIdList, cisIdListAtom]);

  // Initialize unified semester data when terms are available
  useEffect(() => {
    if (termIdList?.length) {
      termIdList.forEach((term) => {
        initializeUnifiedSemester(term.shortName);
      });
    }
  }, [termIdList, initializeUnifiedSemester]);

  // 2. Find latest valid term with courses
  useEffect(() => {
    if (
      authToken &&
      (!enrolledCourses[1] || enrolledCourses[1].length === 0) &&
      cisIdListAtom &&
      termIdList &&
      !fetchAttempted
    ) {
      setFetchAttempted(true);

      // Find the most likely current term
      let primaryTermId;
      let backupTermId;
      let primaryTermShortName;
      let backupTermShortName;

      // First check for terms marked as current in the API
      const currentTerms = termIdList.filter((term) => term.isCurrent);

      if (currentTerms.length > 0) {
        // If we have terms marked as current, use the first one
        primaryTermId = currentTerms[0].id;
        primaryTermShortName = currentTerms[0].shortName;

        // Backup is the second current term or the first term, whichever exists
        backupTermId = currentTerms[1]?.id || termIdList[0].id;
        backupTermShortName =
          currentTerms[1]?.shortName || termIdList[0].shortName;
      } else {
        // Otherwise fall back to the first two terms by index
        primaryTermId = termIdList[0].id;
        primaryTermShortName = termIdList[0].shortName;
        backupTermId = termIdList[1]?.id;
        backupTermShortName = termIdList[1]?.shortName;
      }

      // Make a single request first
      (async () => {
        try {
          const response = await axios.get(
            `https://integration.unisg.ch/EventApi/MyCourses/byTerm/${primaryTermId}`,
            {
              headers: {
                "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
                "X-RequestedLanguage": "DE",
                "API-Version": "1",
                Authorization: `Bearer ${authToken}`,
              },
            }
          );
          setLatestValidTerm(primaryTermShortName);
          // Also update unified state
          setUnifiedLatestValidTerm(primaryTermShortName);

          // If we got data or it's an empty array (which is valid), use it
          updateEnrolledCourses(response.data, 1);

          // Also update unified course data
          updateUnifiedEnrolledCourses(primaryTermShortName, response.data); // Only try backup term if the first one returned an empty array
          if (response.data.length === 0 && backupTermId) {
            try {
              const backupResponse = await axios.get(
                `https://integration.unisg.ch/EventApi/MyCourses/byTerm/${backupTermId}`,
                {
                  headers: {
                    "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
                    "X-RequestedLanguage": "DE",
                    "API-Version": "1",
                    Authorization: `Bearer ${authToken}`,
                  },
                }
              );
              setLatestValidTerm(backupTermShortName);
              // Also update unified state
              setUnifiedLatestValidTerm(backupTermShortName);
              updateEnrolledCourses(backupResponse.data, 2);

              // Also update unified course data
              updateUnifiedEnrolledCourses(
                backupTermShortName,
                backupResponse.data
              );
            } catch (backupError) {
              console.error(
                `[Courses] Error fetching data for backup term:`,
                backupError
              );
              // We already have a valid (though empty) primary term response,
              // so we don't need to call error handling here
            }
          }
        } catch (error) {
          console.error(
            "[Courses] Error fetching data for primary term:",
            error
          );

          // Only try backup if primary failed
          if (backupTermId) {
            try {
              const backupResponse = await axios.get(
                `https://integration.unisg.ch/EventApi/MyCourses/byTerm/${backupTermId}`,
                {
                  headers: {
                    "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
                    "X-RequestedLanguage": "DE",
                    "API-Version": "1",
                    Authorization: `Bearer ${authToken}`,
                  },
                }
              );
              setLatestValidTerm(backupTermShortName);
              // Also update unified state
              setUnifiedLatestValidTerm(backupTermShortName);
              updateEnrolledCourses(backupResponse.data, 2);

              // Also update unified course data
              updateUnifiedEnrolledCourses(
                backupTermShortName,
                backupResponse.data
              );
            } catch (backupError) {
              console.error(
                `[Courses] Error fetching data for backup term:`,
                backupError
              );
              errorHandlingService.handleError(backupError);
            }
          } else {
            errorHandlingService.handleError(error);
          }
        }
      })();
    }
    // eslint-disable-next-line
  }, [authToken, termIdList, cisIdListAtom, enrolledCourses, fetchAttempted]);

  // 3. Setup projections for future semesters
  useEffect(() => {
    if (
      courseInfo &&
      Object.keys(courseInfo).length > 0 &&
      termIdList?.[0] &&
      termIdList?.[1]
    ) {
      const xCourses = 10;

      if (courseInfo[1]?.length > xCourses && termIdList[0]) {
        setLatestValidTermProjection(termIdList[0].shortName);
      } else {
        setLatestValidTermProjection(termIdList[1].shortName);
      }
    }
  }, [courseInfo, termIdList, setLatestValidTermProjection]);

  // 4. Initialize semester selection once latestValidTerm is set
  useEffect(() => {
    if (
      latestValidTerm &&
      fetchAttempted &&
      !initialSelectionMadeRef.current &&
      (selectedSem === "loading semester data..." ||
        selectedSem !== latestValidTerm)
    ) {
      setSelectedSemester(latestValidTerm);
      setSelectedSemesterState(latestValidTerm);

      // Also update unified state
      setUnifiedSelectedSemester(latestValidTerm, termIdList, latestValidTerm);

      const validTermIndex = termIdList?.findIndex(
        (term) => term.shortName === latestValidTerm
      );

      if (validTermIndex !== -1 && validTermIndex !== undefined) {
        setSelectedIndex(validTermIndex);
        initialSelectionMadeRef.current = true;
      }

      setIsLoading(false);
    }
  }, [selectedSem, latestValidTerm, fetchAttempted, termIdList]);

  // Add this new effect to update reference semester when selected semester changes
  useEffect(() => {
    if (termIdList?.length && selectedSem !== "loading semester data...") {
      console.log(
        "🔄 [REFERENCE SEMESTER] Updating reference for selected semester:",
        selectedSem
      );

      const selectedTermIdx = termIdList.findIndex(
        (term) => term.shortName === selectedSem
      );

      const latestValidTermIdx = termIdList.findIndex(
        (term) => term.shortName === latestValidTerm
      );

      // Sort the terms to get proper chronological order
      const sortedTerms = sortTerms(termIdList.map((t) => t.shortName));
      const selectedTermSortedIdx = sortedTerms.indexOf(selectedSem);
      const latestValidTermSortedIdx = sortedTerms.indexOf(latestValidTerm);

      // Check if selected semester is in the future (chronologically after latest valid term)
      const isFutureSemester = selectedTermSortedIdx > latestValidTermSortedIdx;

      console.log(
        "📍 [REFERENCE SEMESTER] Selected index:",
        selectedTermIdx,
        "Latest valid index:",
        latestValidTermIdx
      );
      console.log(
        "📅 [REFERENCE SEMESTER] Chronological order - Selected position:",
        selectedTermSortedIdx,
        "Latest valid position:",
        latestValidTermSortedIdx
      );
      console.log(
        "🔮 [REFERENCE SEMESTER] Is future semester:",
        isFutureSemester
      );

      if (isFutureSemester) {
        // For future semesters, we need to find the appropriate reference semester
        // This should be the semester immediately before the selected one, or the latest valid term
        let referenceTermShortName;

        if (selectedTermSortedIdx > 0) {
          // Use the semester immediately before the selected one
          referenceTermShortName = sortedTerms[selectedTermSortedIdx - 1];
        } else {
          // Fallback to latest valid term
          referenceTermShortName = latestValidTerm;
        }

        // Additional logic: if we're selecting FS26, use FS25 as reference
        // if we're selecting HS26, use HS25 as reference, etc.
        const selectedYear = parseInt(selectedSem.slice(2));
        const selectedSeason = selectedSem.slice(0, 2);
        const potentialReferenceTermShortName =
          selectedSeason + (selectedYear - 1);

        const potentialReferenceExists = termIdList.some(
          (term) => term.shortName === potentialReferenceTermShortName
        );

        if (potentialReferenceExists) {
          referenceTermShortName = potentialReferenceTermShortName;
          console.log(
            "🎯 [REFERENCE SEMESTER] Using year-previous reference term:",
            referenceTermShortName,
            "for future semester:",
            selectedSem
          );
        } else {
          console.log(
            "⚠️ [REFERENCE SEMESTER] Year-previous reference term not found, using chronological previous:",
            referenceTermShortName
          );
        }

        setReferenceSemester(referenceTermShortName);
        // Also update unified state
        setUnifiedFutureSemesterStatus(true, referenceTermShortName);
      } else {
        // For current/past semesters, reference is itself
        console.log(
          "✅ [REFERENCE SEMESTER] Using selected semester as reference (current/past):",
          selectedSem
        );
        setReferenceSemester(selectedSem);
        // Also update unified state
        setUnifiedFutureSemesterStatus(false, null);
      }
    }
    //eslint-disable-next-line
  }, [selectedSem, termIdList, latestValidTerm, courseInfo]);

  // Get sorted terms for the dropdown
  const sortedTermShortNames = termIdList?.length
    ? (() => {
        // Debug: Log the raw termIdList to see what we're working with
        console.log(
          "🔍 [DROPDOWN] Raw termIdList:",
          termIdList.map((t) => `${t.shortName} (ID: ${t.id})`)
        );

        // Log detailed term information to understand duplicates
        console.log("🔍 [DROPDOWN] Full term details:");
        termIdList.forEach((term, index) => {
          console.log(
            `  ${index}: ${term.shortName} | ID: ${term.id} | Current: ${term.isCurrent}`
          );
        });

        // Get unique terms by shortName, but prefer terms with unique IDs (real terms over projections)
        const uniqueTermsMap = new Map();
        const usedIds = new Set();

        // First pass: Add terms with unique IDs (real terms)
        termIdList.forEach((term) => {
          if (!usedIds.has(term.id)) {
            uniqueTermsMap.set(term.shortName, term);
            usedIds.add(term.id);
            console.log(
              `✅ [DROPDOWN] Adding real term: ${term.shortName} (ID: ${term.id})`
            );
          }
        });

        // Second pass: Add terms with duplicate IDs only if shortName is not already present
        termIdList.forEach((term) => {
          if (usedIds.has(term.id) && !uniqueTermsMap.has(term.shortName)) {
            uniqueTermsMap.set(term.shortName, term);
            console.log(
              `➕ [DROPDOWN] Adding projected term: ${term.shortName} (ID: ${term.id}, projection)`
            );
          }
        });

        const uniqueTerms = Array.from(uniqueTermsMap.keys());
        console.log(
          "🔍 [DROPDOWN] Unique terms after deduplication:",
          uniqueTerms
        );

        // Now add missing chronological terms that should exist
        const sortedExistingTerms = sortTerms(uniqueTerms);
        console.log(
          "📅 [DROPDOWN] Existing terms in chronological order:",
          sortedExistingTerms
        );

        const termsToAdd = [];

        // For each existing term, check if the next logical term exists
        sortedExistingTerms.forEach((term, index) => {
          if (index < sortedExistingTerms.length - 1) {
            const currentYear = parseInt(term.slice(2));
            const currentSeason = term.slice(0, 2);
            const nextTerm = sortedExistingTerms[index + 1];

            // Check if there's a gap in the chronological sequence
            let expectedNextTerm;
            if (currentSeason === "FS") {
              expectedNextTerm = `HS${String(currentYear).padStart(2, "0")}`;
            } else if (currentSeason === "HS") {
              expectedNextTerm = `FS${String(currentYear + 1).padStart(
                2,
                "0"
              )}`;
            }

            if (
              expectedNextTerm &&
              expectedNextTerm !== nextTerm &&
              !uniqueTerms.includes(expectedNextTerm)
            ) {
              termsToAdd.push(expectedNextTerm);
              console.log(
                `➕ [DROPDOWN] Adding missing chronological term: ${expectedNextTerm} (between ${term} and ${nextTerm})`
              );
            }
          }
        });

        // Also add one term after the last existing term
        if (sortedExistingTerms.length > 0) {
          const lastTerm = sortedExistingTerms[sortedExistingTerms.length - 1];
          const lastYear = parseInt(lastTerm.slice(2));
          const lastSeason = lastTerm.slice(0, 2);

          let nextLogicalTerm;
          if (lastSeason === "FS") {
            nextLogicalTerm = `HS${String(lastYear).padStart(2, "0")}`;
          } else if (lastSeason === "HS") {
            nextLogicalTerm = `FS${String(lastYear + 1).padStart(2, "0")}`;
          }

          if (nextLogicalTerm && !uniqueTerms.includes(nextLogicalTerm)) {
            termsToAdd.push(nextLogicalTerm);
            console.log(
              `➕ [DROPDOWN] Adding next logical term after ${lastTerm}: ${nextLogicalTerm}`
            );
          }
        }

        const allTerms = [...uniqueTerms, ...termsToAdd];
        console.log(
          "📋 [DROPDOWN] All terms including added future terms:",
          allTerms
        );

        // Sort them chronologically
        const sorted = sortTerms(allTerms);
        console.log("📋 [DROPDOWN] Final sorted terms:", sorted);
        return sorted;
      })()
    : ["loading semester data..."];

  // Log dropdown contents
  console.log(
    "📋 [DROPDOWN] Available terms for selection:",
    sortedTermShortNames
  );

  // Handle term selection
  const handleTermSelect = (termValue) => {
    console.log("👆 [USER SELECTION] User selected term:", termValue);
    setSelectedSemester(termValue);

    // Find the selected term in the original termIdList
    const selectedIdx = termIdList.findIndex(
      (term) => term.shortName === termValue
    );

    console.log("📍 [USER SELECTION] Setting index to:", selectedIdx);

    if (selectedIdx !== -1) {
      // Term exists in original list
      setSelectedIndex(selectedIdx);
      console.log("✅ [USER SELECTION] Found existing term in termIdList");
    } else {
      // This is a future term we added, need to handle it specially
      console.log(
        "🔮 [USER SELECTION] Selected term is a future semester not in original termIdList"
      );

      // For future semesters, we need to set up reference data
      const selectedYear = parseInt(termValue.slice(2));
      const selectedSeason = termValue.slice(0, 2);
      const referenceTermShortName = selectedSeason + (selectedYear - 1);

      console.log(
        "🎯 [USER SELECTION] Setting reference semester for future term:",
        referenceTermShortName
      );
      setReferenceSemester(referenceTermShortName);

      // Set index to -1 to indicate this is a future term
      setSelectedIndex(-1);
    }

    setSelectedSemesterState(termValue);

    // Also update unified state with future semester detection
    setUnifiedSelectedSemester(termValue, termIdList, latestValidTerm);
  };

  return {
    isLoading,
    selectedSem,
    latestValidTerm,
    sortedTermShortNames,
    handleTermSelect,
    termIdList,
  };
}
