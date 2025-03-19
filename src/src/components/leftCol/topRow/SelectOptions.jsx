// SelectOptions.jsx //
// 

import { useRecoilState, useRecoilValue } from "recoil";
import { cisIdListSelector } from "../../recoil/cisIdListSelector";
import { latestValidTermAtom } from "../../recoil/latestValidTermAtom";
import axios from "axios";
import { useEffect, useState, useMemo } from "react";
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
import { selectedSemesterIndexAtom } from "../../recoil/selectedSemesterIndexAtom";

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
    return yearA !== yearB ? yearA - yearB : 
           seasonA === "FS" && seasonB === "HS" ? -1 : 
           seasonA === "HS" && seasonB === "FS" ? 1 : 0;
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
    if (authToken && !cisIdListAtom) {
      (async () => {
        //only fetch if cisIdListAtom is empty else use stored value
        try {
          await axios
            .get(
              `https://integration.unisg.ch/EventApi/CisTermAndPhaseInformations`,
              {
                headers: {
                  "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
                  "X-RequestedLanguage": "DE", // careful when working different languages (DE, EN)
                  "API-Version": "1",
                  Authorization: `Bearer ${authToken}`,
                },
              }
            )
            .then((response) => setCisIdList(response.data));
        } catch (error) {
          console.error("Error fetching data:", error);
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
    if (
      authToken &&
      (!enrolledCourses[1] || enrolledCourses[1].length === 0) &&
      cisIdListAtom &&
      termIdList &&
      !fetchAttempted
    ) {
      let newestTermId;
      let secondNewestTermId;
      //take the newest term that is marked current
      //note: when new term is published other api calls can be different
      //observed before: Empty response of current enrollments or 429 status code
      //thats why we need the handling below
      if (termIdList[0].isCurrent) {
        newestTermId = termIdList[0].id;
      } else if (termIdList[1].isCurrent) {
        secondNewestTermId = termIdList[1].id;
      } else {
        if (termIdList[1].isCurrent) {
          newestTermId = termIdList[1].id;
        } else if (termIdList[2].isCurrent) {
          secondNewestTermId = termIdList[2].id;
        } else {
          console.error("No current term found");
        }
      }

      (async () => {
        //only fetch if eventListAtom is empty else use stored value
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
          console.error("Error fetching data:", error);
          // errorHandlingService.handleError(error);  --> this is ignored because is meant to fail in certain cases
          // if status code 429, then new cisId is not implemented yet at uni IT
          // try again with second newest term
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
            console.error("Error fetching data:", error);
            errorHandlingService.handleError(error);
          }
        } finally {
          setFetchAttempted(true); // avoids infinite loop when failing to fetch
        }
      })();
    }
    // do not include setters. causes additional rerender
    // eslint-disable-next-line
  }, [authToken, termIdList, cisIdListAtom, enrolledCourses, fetchAttempted]);

  const [selectedSem, setSelectedSemester] = useState(
    "loading semester data..."
  );
  
  const selectedSemId = termIdList.find(
    (term) => term.shortName === selectedSem
  );

  //for semesters that lay in the future
  const courseInfo = useRecoilValue(courseInfoState);
  const [, setLatestValidTermProjection] = useRecoilState(
    latestValidTermProjectionState
  );

  // handle semesters that lay in the future
  useEffect(() => {
    if (
      courseInfo &&
      Object.keys(courseInfo).length > 0 &&
      termIdList[0] &&
      termIdList[1]
    ) {
      // Check which indexes (semesters) are populated and have more than xCourses
      let xCourses = 10; // Ignores semesters with less than 10 courses for projection, also prevents default selection of semesters (this was tested when selected semester default value was null!) with less than 10 courses

      if (courseInfo[1]?.length > xCourses && termIdList[0]) {
        // the first (newest) is considered valid and will be copied along its neighbor [2] for projection into the future
        setLatestValidTermProjection(termIdList[0].shortName);
      } else {
        // the second (newest) is considered valid and will be copied along its neighbor [3] for projection into the future
        setLatestValidTermProjection(termIdList[1].shortName);
      }
    }
  }, [courseInfo, termIdList]);

  // handle semesters selection
  useEffect(() => {
    if (selectedSem === "loading semester data..." && latestValidTerm) {
      setSelectedSemester(latestValidTerm);
    }
  }, [selectedSem, latestValidTerm]);

  const sortedTermShortNames = useMemo(() => {
    if (!termIdList?.length) {
      return ["loading semester data..."];
    }
    const shortNames = termIdList.map(term => term.shortName);
    return sortTerms(shortNames);
  }, [termIdList]);



  const handleSelect = (selectedOption) => {
    setSelectedSemester(selectedOption.value);
    const selectedIndex = termIdList.findIndex(
      (term) => term.shortName === selectedOption.value
    );
    setSelectedIndex(selectedIndex);
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
