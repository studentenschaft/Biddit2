// SelectOptions.jsx //
//

import { useRecoilState, useRecoilValue } from "recoil";
import { cisIdListSelector } from "../../recoil/cisIdListSelector";
import { latestValidTermAtom } from "../../recoil/latestValidTermAtom";
import axios from "axios";
import { useEffect, useState, useMemo, useRef } from "react";
import { authTokenState } from "../../recoil/authAtom";
import { cisIdList } from "../../recoil/cisIdListAtom";
import { enrolledCoursesState } from "../../recoil/enrolledCoursesAtom";
import { SelectClassification } from "./SelectClassification";
import { SelectEcts } from "./SelectEcts";
import { SelectLanguage } from "./SelectLanguage";
import { SelectLecturer } from "./SelectLecturer";
import { SelectRatings } from "./SelectRatings";
import { SearchTerm } from "./SearchTerm";
import Select from "react-select";
import { selectedSemesterIndexAtom } from "../../recoil/selectedSemesterAtom";
import { selectedSemesterAtom } from "../../recoil/selectedSemesterAtom";

import ErrorBoundary from "../../../components/errorHandling/ErrorBoundary";

//for semesters that lay in the future
import { courseInfoState } from "../../recoil/courseInfoAtom";
import { latestValidTermProjectionState } from "../../recoil/latestValidTermProjection";

// helpers
import { useUpdateEnrolledCoursesAtom } from "../../helpers/useUpdateEnrolledCourses";

// error handling
import { errorHandlingService } from "../../errorHandling/ErrorHandlingService";
// children components
import { EventListContainer } from "../bottomRow/EventListContainer";

// Future semesters
import { isFutureSemesterSelected } from "../../recoil/isFutureSemesterSelected";

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

export default function SelectSemester() {
  const authToken = useRecoilValue(authTokenState);
  const [cisIdListAtom, setCisIdList] = useRecoilState(cisIdList);
  const termIdList = useRecoilValue(cisIdListSelector);
  const [latestValidTerm, setLatestValidTerm] =
    useRecoilState(latestValidTermAtom);
  const enrolledCourses = useRecoilValue(enrolledCoursesState);
  const [, setSelectedIndex] = useRecoilState(selectedSemesterIndexAtom);
  const isFutureSemester = useRecoilValue(isFutureSemesterSelected);
  const [, setSelectedSemesterState] = useRecoilState(selectedSemesterAtom);

  // open/close search options
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev);
  };

  // helpers
  const updateEnrolledCourses = useUpdateEnrolledCoursesAtom();

  // suspense doc
  // https://recoiljs.org/docs/guides/asynchronous-data-queries
  useEffect(() => {
    console.log(
      "[CisIdList] Effect triggered - authToken exists:",
      !!authToken,
      "cisIdListAtom exists:",
      !!cisIdListAtom
    );
    if (authToken && !cisIdListAtom) {
      console.log("[CisIdList] Conditions met, initiating fetch");
      (async () => {
        //only fetch if cisIdListAtom is empty else use stored value
        try {
          console.log("[CisIdList] Making API request");
          const response = await axios.get(
            `https://integration.unisg.ch/EventApi/CisTermAndPhaseInformations`,
            {
              headers: {
                "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
                "X-RequestedLanguage": "DE", // careful when working different languages (DE, EN)
                "API-Version": "1",
                Authorization: `Bearer ${authToken}`,
              },
            }
          );
          console.log("[CisIdList] API response received:", response.data);
          setCisIdList(response.data);
          console.log("[CisIdList] State updated with term data");
        } catch (error) {
          console.error("[CisIdList] Error fetching data:", error);
          console.log(
            "[CisIdList] Error details:",
            error.response?.data,
            "Status:",
            error.response?.status
          );
          errorHandlingService.handleError(error);
        }
      })();
    }
  }, [authToken, setCisIdList, cisIdListAtom]);

  // load courses for the newest term that has courses
  // set state that gives info if latest term has courses or not
  // TODO: only set latest valid term if a certain number of courses are published

  const [fetchAttempted, setFetchAttempted] = useState(false);

  useEffect(() => {
    console.log("[Courses] Effect triggered with:", {
      authToken: !!authToken,
      enrolledCoursesExist: !(
        !enrolledCourses[1] || enrolledCourses[1].length === 0
      ),
      cisIdListExists: !!cisIdListAtom,
      termIdListExists: !!termIdList,
      fetchAttempted,
    });

    if (
      authToken &&
      (!enrolledCourses[1] || enrolledCourses[1].length === 0) &&
      cisIdListAtom &&
      termIdList &&
      !fetchAttempted
    ) {
      console.log("[Courses] All conditions met for fetch");
      let newestTermId;
      let secondNewestTermId;
      console.log("[Courses] TermIdList first items:", termIdList.slice(0, 3));

      //take the newest term that is marked current
      //note: when new term is published other api calls can be different
      //observed before: Empty response of current enrollments or 429 status code
      //thats why we need the handling below
      if (termIdList[0].isCurrent) {
        newestTermId = termIdList[0].id;
        console.log(
          "[Courses] Using newest term:",
          termIdList[0].shortName,
          "ID:",
          newestTermId
        );
      } else if (termIdList[1].isCurrent) {
        secondNewestTermId = termIdList[1].id;
        console.log(
          "[Courses] Using second newest term:",
          termIdList[1].shortName,
          "ID:",
          secondNewestTermId
        );
      } else {
        if (termIdList[1].isCurrent) {
          newestTermId = termIdList[1].id;
          console.log(
            "[Courses] Fallback to term 1:",
            termIdList[1].shortName,
            "ID:",
            newestTermId
          );
        } else if (termIdList[2].isCurrent) {
          secondNewestTermId = termIdList[2].id;
          console.log(
            "[Courses] Fallback to term 2:",
            termIdList[2].shortName,
            "ID:",
            secondNewestTermId
          );
        } else {
          console.error("[Courses] No current term found in termIdList");
        }
      }

      (async () => {
        //only fetch if eventListAtom is empty else use stored value
        try {
          console.log(
            "[Courses] Fetching courses for newest term:",
            newestTermId
          );
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
          console.log(
            "[Courses] Newest term response - courses count:",
            response.data.length
          );
          setLatestValidTerm(termIdList[0].shortName);
          console.log(
            "[Courses] Set latest valid term to:",
            termIdList[0].shortName
          );

          if (response.data.length === 0) {
            console.log(
              "[Courses] No courses found, trying second term:",
              secondNewestTermId
            );
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
            console.log(
              "[Courses] Second term response - courses count:",
              response.data.length
            );
            setLatestValidTerm(termIdList[1].shortName);
            console.log(
              "[Courses] Updated latest valid term to:",
              termIdList[1].shortName
            );
            updateEnrolledCourses(response.data, 2);
            console.log("[Courses] Updated enrolled courses with index 2");
          } else {
            updateEnrolledCourses(response.data, 1);
            console.log("[Courses] Updated enrolled courses with index 1");
          }
        } catch (error) {
          console.error(
            "[Courses] Error fetching data for newest term:",
            error
          );
          console.log("[Courses] Error details:", {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
          });
          // errorHandlingService.handleError(error);  --> this is ignored because is meant to fail in certain cases
          // if status code 429, then new cisId is not implemented yet at uni IT
          // try again with second newest term
          try {
            console.log(
              "[Courses] Attempting fallback to second term:",
              secondNewestTermId
            );
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
            console.log(
              "[Courses] Fallback successful - courses count:",
              response.data.length
            );
            setLatestValidTerm(termIdList[1].shortName);
            console.log(
              "[Courses] Set latest term to:",
              termIdList[1].shortName
            );
            updateEnrolledCourses(response.data, 2);
            console.log("[Courses] Updated enrolled courses with index 2");
          } catch (error) {
            console.error("[Courses] Fallback fetch also failed:", error);
            console.log("[Courses] Fallback error details:", {
              status: error.response?.status,
              data: error.response?.data,
            });
            errorHandlingService.handleError(error);
          }
        } finally {
          setFetchAttempted(true); // avoids infinite loop when failing to fetch
          console.log("[Courses] Set fetchAttempted to true");
        }
      })();
    }
    // do not include setters. causes additional rerender
    // eslint-disable-next-line
  }, [authToken, termIdList, cisIdListAtom, enrolledCourses, fetchAttempted]);

  const [selectedSem, setSelectedSemester] = useState(
    "loading semester data..."
  );

  const selectedSemId = useMemo(() => {
    if (!selectedSem || selectedSem === "loading semester data...") return null;

    // First try to find a match with the current semester
    const matchingTerms = termIdList.filter(
      (term) => term.shortName === selectedSem
    );
    console.log(
      "[Selection] Found",
      matchingTerms.length,
      "matching terms for",
      selectedSem
    );

    if (matchingTerms.length > 1) {
      // If multiple matches, prefer the one that matches latestValidTerm
      if (selectedSem === latestValidTerm) {
        const validTerm = matchingTerms.find((term) => term.isCurrent);
        if (validTerm) {
          console.log("[Selection] Using current term for latest valid term");
          return validTerm;
        }
      }
      console.log("[Selection] Using first matching term as fallback");
    }

    return matchingTerms[0] || null;
  }, [selectedSem, termIdList, latestValidTerm]);

  //for semesters that lay in the future
  const courseInfo = useRecoilValue(courseInfoState);
  const [, setLatestValidTermProjection] = useRecoilState(
    latestValidTermProjectionState
  );

  // handle semesters that lay in the future
  useEffect(() => {
    console.log(
      "[Future] Effect triggered - courseInfo entries:",
      Object.keys(courseInfo || {}).length,
      "term0:",
      termIdList?.[0]?.shortName,
      "term1:",
      termIdList?.[1]?.shortName
    );

    if (
      courseInfo &&
      Object.keys(courseInfo).length > 0 &&
      termIdList[0] &&
      termIdList[1]
    ) {
      // Check which indexes (semesters) are populated and have more than xCourses
      let xCourses = 10; // Ignores semesters with less than 10 courses for projection, also prevents default selection of semesters (this was tested when selected semester default value was null!) with less than 10 courses
      console.log("[Future] Course counts:", {
        index1: courseInfo[1]?.length || 0,
        index2: courseInfo[2]?.length || 0,
      });

      if (courseInfo[1]?.length > xCourses && termIdList[0]) {
        // the first (newest) is considered valid and will be copied along its neighbor [2] for projection into the future
        setLatestValidTermProjection(termIdList[0].shortName);
        console.log(
          "[Future] Set projection to newest term:",
          termIdList[0].shortName
        );
      } else {
        // the second (newest) is considered valid and will be copied along its neighbor [3] for projection into the future
        setLatestValidTermProjection(termIdList[1].shortName);
        console.log(
          "[Future] Set projection to second term:",
          termIdList[1].shortName
        );
      }
    }
  }, [courseInfo, termIdList, setLatestValidTermProjection]);

  // handle semesters selection
  const initialSelectionMadeRef = useRef(false);

  useEffect(() => {
    console.log(
      "[Selection] Effect triggered - selectedSem:",
      selectedSem,
      "latestValidTerm:",
      latestValidTerm,
      "initialSelectionMade:",
      initialSelectionMadeRef.current,
      "fetchAttempted:",
      fetchAttempted
    );

    // IMPORTANT: Only select a semester when latestValidTerm is set AND fetch has been attempted
    // This ensures we don't select before data is available
    if (
      latestValidTerm &&
      fetchAttempted && // Added this condition to ensure data is loaded
      !initialSelectionMadeRef.current &&
      (selectedSem === "loading semester data..." ||
        selectedSem !== latestValidTerm)
    ) {
      console.log(
        "[Selection] Setting initial semester to latest valid term:",
        latestValidTerm
      );
      setSelectedSemester(latestValidTerm);
      setSelectedSemesterState(latestValidTerm);

      // Also update the selectedIndex - with better error handling
      const validTermIndex = termIdList?.findIndex(
        (term) => term.shortName === latestValidTerm
      );
      if (validTermIndex !== -1 && validTermIndex !== undefined) {
        console.log("[Selection] Setting index to:", validTermIndex);
        setSelectedIndex(validTermIndex);

        // Mark that we've done the initial selection - ONLY AFTER successful selection
        initialSelectionMadeRef.current = true;
        console.log("[Selection] Initial selection completed successfully");
      } else {
        console.error(
          "[Selection] Could not find index for term:",
          latestValidTerm,
          "in termIdList"
        );
      }
    }
  }, [
    selectedSem,
    latestValidTerm,
    fetchAttempted, // Add fetchAttempted to the dependency array
    setSelectedSemesterState,
    termIdList,
    setSelectedIndex,
  ]);

  const sortedTermShortNames = useMemo(() => {
    console.log(
      "[Sorting] Computing sorted terms from",
      termIdList?.length || 0,
      "terms"
    );
    if (!termIdList?.length) {
      console.log("[Sorting] No terms, returning loading placeholder");
      return ["loading semester data..."];
    }

    // Get unique shortNames by using a Set
    const shortNames = [...new Set(termIdList.map((term) => term.shortName))];
    const sorted = sortTerms(shortNames);
    console.log("[Sorting] Result:", sorted);
    return sorted;
  }, [termIdList]);

  const handleSelect = (selectedOption) => {
    console.log("[Selection] User selected:", selectedOption.value);
    setSelectedSemester(selectedOption.value);
    const selectedIndex = termIdList.findIndex(
      (term) => term.shortName === selectedOption.value
    );
    console.log("[Selection] Found at index:", selectedIndex);
    setSelectedIndex(selectedIndex);
    setSelectedSemesterState(selectedOption.value);
  };

  // https://react-select.com/home

  // Add loading state check for GUI improvement
  const isLoading =
    !termIdList ||
    termIdList.length === 0 ||
    selectedSem === "loading semester data...";
  if (isLoading) {
    return (
      <div className="space-y-4">
        {" "}
        {/* Container with vertical spacing */}
        {/* Semester Selector Skeleton */}
        <div className="w-full h-10 bg-gray-200 rounded animate-pulse" />
        {/* Classification Skeleton */}
        <div className="w-full h-10 bg-gray-200 rounded animate-pulse" />
        {/* Lecturer Skeleton */}
        <div className="w-full h-10 bg-gray-200 rounded animate-pulse" />
        {/* ECTS, Language, Ratings Row Skeleton */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
        </div>
        {/* Search Term Skeleton */}
        <div className="w-full h-10 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <Select
        className="text-sm"
        name="semester"
        id="semester"
        value={{ value: selectedSem, label: selectedSem }}
        onChange={handleSelect}
        options={sortedTermShortNames.map((term) => ({
          value: term,
          label: term,
        }))}
        placeholder="Select Semester"
      />
      <h5 className="mt-4 mb-2 text-sm font-medium leading-6 text-gray-500 ">
        {isFutureSemester &&
          "Disclaimer: The course data for your currently selected semester is not yet confirmed and may not be accurate. We display it as a preview for you to be able to plan ahead. We will update the data as soon as HSG releases it."}
      </h5>

      <h3 className="mt-4 mb-2 text-lg font-medium leading-6 text-gray-900 ">
        Search & Filter
        <button
          onClick={toggleCollapse}
          className="ml-2 text-sm text-gray-500 hover:underline"
        >
          {isCollapsed ? "Show" : "Hide"}
        </button>
      </h3>

      {!isCollapsed && (
        <div className="text-sm">
          <SelectClassification className="w-full" />
          <SelectLecturer className="w-full" />
          <div
            className="grid grid-cols-1 md:grid-cols-3"
            style={{ marginBottom: "10px" }}
          >
            <SelectEcts />
            <SelectLanguage />
            <SelectRatings />
          </div>
          <SearchTerm />
        </div>
      )}
      <ErrorBoundary>
        <EventListContainer selectedSemesterState={selectedSemId} />
      </ErrorBoundary>
    </>
  );
}
export { SelectSemester };
