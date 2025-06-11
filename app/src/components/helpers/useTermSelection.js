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
      const selectedTermIdx = termIdList.findIndex(
        (term) => term.shortName === selectedSem
      );

      // Check if selected semester is in the future
      const isFutureSemester =
        /* determine if this is a future semester */
        // You can compare dates, check a flag, or use your existing method
        selectedTermIdx >
        termIdList.findIndex((term) => term.shortName === latestValidTerm);
      if (isFutureSemester) {
        // Use the reference semester for future semester projections
        const referenceTermShortName =
          courseInfo[1]?.length > 10 && termIdList[0]
            ? termIdList[0].shortName
            : termIdList[1].shortName;

        setReferenceSemester(referenceTermShortName);
        // Also update unified state
        setUnifiedFutureSemesterStatus(true, referenceTermShortName);
      } else {
        // For current/past semesters, reference is itself
        setReferenceSemester(selectedSem);
        // Also update unified state
        setUnifiedFutureSemesterStatus(false, null);
      }
    }
  }, [selectedSem, termIdList, latestValidTerm, courseInfo]);

  // Get sorted terms for the dropdown
  const sortedTermShortNames = termIdList?.length
    ? [...new Set(termIdList.map((term) => term.shortName))].sort((a, b) =>
        sortTerms([a, b])[0] === a ? -1 : 1
      )
    : ["loading semester data..."];
  // Handle term selection
  const handleTermSelect = (termValue) => {
    setSelectedSemester(termValue);
    const selectedIdx = termIdList.findIndex(
      (term) => term.shortName === termValue
    );
    setSelectedIndex(selectedIdx);
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
