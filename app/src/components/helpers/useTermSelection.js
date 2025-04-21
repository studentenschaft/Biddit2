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

  // Local state
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSem, setSelectedSemester] = useState(
    "loading semester data..."
  );
  const initialSelectionMadeRef = useRef(false);

  // Helpers
  const updateEnrolledCourses = useUpdateEnrolledCoursesAtom();

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

  // 2. Find latest valid term with courses
  useEffect(() => {
    if (
      authToken &&
      (!enrolledCourses[1] || enrolledCourses[1].length === 0) &&
      cisIdListAtom &&
      termIdList &&
      !fetchAttempted
    ) {
      let newestTermId;
      let secondNewestTermId;

      if (termIdList[0].isCurrent) {
        newestTermId = termIdList[0].id;
      } else if (termIdList[1].isCurrent) {
        secondNewestTermId = termIdList[1].id;
      } else {
        if (termIdList[1].isCurrent) {
          newestTermId = termIdList[1].id;
        } else if (termIdList[2].isCurrent) {
          secondNewestTermId = termIdList[2].id;
        }
      }

      (async () => {
        try {
          let response = await axios.get(
            `https://integration.unisg.ch/EventApi/MyCourses/byTerm/${newestTermId}`,
            {
              headers: {
                "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
                "X-RequestedLanguage": "EN",
                "API-Version": "1",
                Authorization: `Bearer ${authToken}`,
              },
            }
          );

          setLatestValidTerm(termIdList[0].shortName);

          if (response.data.length === 0) {
            response = await axios.get(
              `https://integration.unisg.ch/EventApi/MyCourses/byTerm/${secondNewestTermId}`,
              {
                headers: {
                  "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
                  "X-RequestedLanguage": "EN",
                  "API-Version": "1",
                  Authorization: `Bearer ${authToken}`,
                },
              }
            );
            setLatestValidTerm(termIdList[1].shortName);
            updateEnrolledCourses(response.data, 2);
          } else {
            updateEnrolledCourses(response.data, 1);
          }
        } catch (error) {
          console.error(
            "[Courses] Error fetching data for newest term:",
            error
          );

          // Fallback to second newest term
          try {
            const response = await axios.get(
              `https://integration.unisg.ch/EventApi/MyCourses/byTerm/${secondNewestTermId}`,
              {
                headers: {
                  "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
                  "X-RequestedLanguage": "EN",
                  "API-Version": "1",
                  Authorization: `Bearer ${authToken}`,
                },
              }
            );
            setLatestValidTerm(termIdList[1].shortName);
            updateEnrolledCourses(response.data, 2);
          } catch (error) {
            errorHandlingService.handleError(error);
          }
        } finally {
          setFetchAttempted(true);
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

      const validTermIndex = termIdList?.findIndex(
        (term) => term.shortName === latestValidTerm
      );

      if (validTermIndex !== -1 && validTermIndex !== undefined) {
        setSelectedIndex(validTermIndex);
        initialSelectionMadeRef.current = true;
      }

      setIsLoading(false);
    }
  }, [
    selectedSem,
    latestValidTerm,
    fetchAttempted,
    setSelectedSemesterState,
    termIdList,
    setSelectedIndex,
  ]);

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
