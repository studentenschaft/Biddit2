/**
 * EventListContainer Component
 * manages and displays a virtualized list of university courses
 * Key features:
 * - Fetches and displays enrolled courses for a selected semester
 * - Shows course ratings from SHSG API
 * - Implements virtual scrolling for performance
 * - Filters courses based on user selection
 * - Handles course enrollment status
 * - allows for adding courses to the user's schedule (TODO)
 */

import axios from "axios";
import PropTypes from "prop-types";
import { useRecoilState, useRecoilValue } from "recoil";
import { enrolledCoursesState } from "../../recoil/enrolledCoursesAtom";
import { useEffect, useState, Suspense } from "react";
import { authTokenState } from "../../recoil/authAtom";
import { courseInfoState } from "../../recoil/courseInfoAtom";
import { shsgCourseRatingsState } from "../../recoil/shsgCourseRatingsAtom";
import { allCourseInfoState } from "../../recoil/allCourseInfosSelector";
import { filteredCoursesSelector } from "../../recoil/filteredCoursesSelector";
import { FixedSizeList } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import LoadingText from "../../common/LoadingText";
import { localSelectedCoursesState } from "../../recoil/localSelectedCoursesAtom";
import { cisIdListSelector } from "../../recoil/cisIdListSelector";
// helpers for updating Recoil atoms
import { useUpdateEnrolledCoursesAtom } from "../../helpers/useUpdateEnrolledCourses";
import { useUpdateCourseInfoAtom } from "../../helpers/useUpdateCourseInfo";

// error handling service
import { errorHandlingService } from "../../errorHandling/ErrorHandlingService";

//icons
import { PlusIcon } from "@heroicons/react/outline";
import { StarIcon } from "@heroicons/react/solid";

// custom components
import { LockClosed } from "./LockClosed";
import { LockOpen } from "./LockOpen";

// recoil tabs
import { selectedTabAtom } from "../../recoil/selectedTabAtom";

//recoil selected course
import { selectedCourseCourseInfo } from "../../recoil/selectedCourseCourseInfo";
import { localSelectedCoursesSemKeyState } from "../../recoil/localSelectedCoursesSemKeyAtom";
// mobile view toggle of selected course / left view
import { isLeftViewVisible } from "../../recoil/isLeftViewVisible";

// recoil studyPlan (SHSG Backend Data)
import { studyPlanAtom } from "../../recoil/studyPlanAtom";

import { selectedCourseIdsAtom } from "../../recoil/selectedCourseIdsAtom";

// API calls for selected course
import { getStudyPlan } from "../../helpers/api";

import { currentStudyPlanIdState } from "../../recoil/currentStudyPlanIdAtom";

// future Semesters
import {
  isFutureSemesterSelected,
  referenceSemester,
} from "../../recoil/isFutureSemesterSelected";
import { findStudyPlanBySemester } from "../../helpers/courseSelection";
import { useCurrentSemester } from "../../helpers/studyOverviewHelpers";

// Now we import our custom hook
import { useCourseSelection } from "../../helpers/useCourseSelection";

// helper function - TODO: put into own file
function isEventOrNestedCourseSelected(event, selectedCourseIds) {
  // safety check to avoid NULL error:
  if (!Array.isArray(selectedCourseIds)) {
    console.warn("selectedCourseIds is not an array:", selectedCourseIds);
    return false;
  }
  // Check if the top-level event.id matches
  if (
    selectedCourseIds.includes(event.id) ||
    selectedCourseIds.includes(event.courseNumber)
  )
    return true;
  // If event.courses exists, check each nested course
  // MB 11.02.25: Disabled due to new handling of nested courses -> lead to wrong open locks for exercise groups
  // if (event.courses && Array.isArray(event.courses)) {
  //   return event.courses.some((course) =>
  //     selectedCourseIds.includes(course.id)
  //   );
  // }
  return false;
}

export default function EventListContainer({ selectedSemesterState }) {
  // Recoil values and state hooks
  const authToken = useRecoilValue(authTokenState); // User's authentication token
  const enrolledCourses = useRecoilValue(enrolledCoursesState); // Enrolled courses from Recoil state
  const courseInfos = useRecoilValue(courseInfoState); // Course information from Recoil state
  const [shsgCourseRatings, setShsgCourseRatings] = useRecoilState(
    shsgCourseRatingsState
  ); // Course ratings from SHSG API
  const allCourseInfo = useRecoilValue(allCourseInfoState); // All course information from Recoil state
  const [completeCourseInfo, setCompleteCourseInfo] = useState([]); // Local state for complete course info
  const filteredCoursesState = useRecoilValue(filteredCoursesSelector); // Filtered courses from Recoil selector
  const [filteredCourses, setFilteredCourses] = useState([]); // Local state for filtered courses
  const [isLoading, setIsLoading] = useState(true); // Loading state for the component

  const [, setCurrentStudyPlanId] = useState(null); // Current study plan ID
  const [, setCurrentStudyPlanIdState] = useRecoilState(
    currentStudyPlanIdState
  ); // Recoil state for current study plan ID
  const [, setStudyPlan] = useRecoilState(studyPlanAtom);

  // Helpers to update Recoil atoms
  const updateEnrolledCourses = useUpdateEnrolledCoursesAtom();
  const updateCourseInfo = useUpdateCourseInfoAtom();

  const [selectedCourseIds, setSelectedCourseIds] = useRecoilState(
    selectedCourseIdsAtom
  );

  // Recoil states
  const cisIdList = useRecoilValue(cisIdListSelector);
  const [, setIsFutureSemesterSelected] = useRecoilState(
    isFutureSemesterSelected
  );
  const currentRealSemesterName = useCurrentSemester(); // Get current semester name (real life)
  const [referenceSemesterState, setReferenceSemesterState] =
    useRecoilState(referenceSemester);
  // mobile view toggle of selected course / left view
  const [, setIsLeftViewVisibleState] = useRecoilState(isLeftViewVisible);

  let cisId = null;
  let index = null;
  if (selectedSemesterState) {
    cisId = selectedSemesterState.cisId;
    index = selectedSemesterState.index;
    // if a future semester is selected, handle here
    if (!allCourseInfo[index]) {
      if (index === cisIdList.length) {
        index = 2;
        setIsFutureSemesterSelected(true);
        setReferenceSemesterState(cisIdList[1]);
      }
      if (index === cisIdList.length - 1) {
        index = 1;
        setIsFutureSemesterSelected(true);
        setReferenceSemesterState(cisIdList[0]);
      }
    } else {
      setIsFutureSemesterSelected(false);
      setReferenceSemesterState(null);
    }
  }

  const [, setSelectedTabState] = useRecoilState(selectedTabAtom);
  const [, setSelectedCourseCourseInfo] = useRecoilState(
    selectedCourseCourseInfo
  );
  const [, setLocalSelectedCourses] = useRecoilState(localSelectedCoursesState);
  const [localSelectedBySemester, setLocalSelectedCoursesSemKey] =
    useRecoilState(localSelectedCoursesSemKeyState);

  // useEffect to see if localSelectedBySemester changes
  useEffect(() => {
    console.log(
      "DEBUG: localSelectedBySemester changed",
      localSelectedBySemester
    );
  }, [localSelectedBySemester]);

  // Instead of duplicating the logic, we use our new hook
  const { addOrRemoveCourse } = useCourseSelection({
    selectedCourseIds,
    setSelectedCourseIds,
    selectedSemesterShortName: selectedSemesterState?.shortName || "",
    index,
    authToken,
  });

  const [currentStudyPlan, setCurrentStudyPlan] = useState(null);
  useEffect(() => {
    // Fetch the study plan if we have an authToken and a selected semester
    const fetchStudyPlanData = async () => {
      if (!authToken || !selectedSemesterState) {
        console.error("No auth token or selected semester");
        return;
      }

      try {
        setStudyPlan((prev) => ({ ...prev, isLoading: true }));
        const studyPlansData = await getStudyPlan(authToken);

        // Use new helper to find matching plan
        const currentSemesterId = selectedSemesterState.cisId;
        const semesterName = selectedSemesterState.shortName;

        const foundStudyPlan = findStudyPlanBySemester(
          studyPlansData,
          currentSemesterId,
          semesterName,
          currentRealSemesterName
        );

        console.warn("studyPlan found:", foundStudyPlan);

        if (foundStudyPlan) {
          // Set global state first
          setSelectedCourseIds(foundStudyPlan.courses);
          setCurrentStudyPlanId(foundStudyPlan.id);
          setCurrentStudyPlanIdState(foundStudyPlan.id);
          setCurrentStudyPlan(foundStudyPlan);

          // Then immediately set local selected courses while we have the data in scope
          // Only update if we have course info for this semester
          if (allCourseInfo[index] && allCourseInfo[index].length > 0) {
            // Update index-based atom
            setLocalSelectedCourses((prevCourses) => {
              const updatedCourses = { ...prevCourses };
              updatedCourses[index] = foundStudyPlan.courses
                .map((courseIdentifier) => {
                  return allCourseInfo[index].find(
                    (course) =>
                      course.courseNumber === courseIdentifier ||
                      course.id === courseIdentifier
                  );
                })
                .filter(Boolean);
              return updatedCourses;
            });

            // Update semester key-based atom
            setLocalSelectedCoursesSemKey((prevCourses) => {
              const updatedCourses = { ...prevCourses };
              const semKey = selectedSemesterState.shortName;
              updatedCourses[semKey] = foundStudyPlan.courses
                .map((courseIdentifier) => {
                  const course = allCourseInfo[index].find(
                    (c) =>
                      c.courseNumber === courseIdentifier ||
                      c.id === courseIdentifier
                  );
                  if (!course) return null;
                  return {
                    id: course.id,
                    shortName: course.shortName,
                    classification: course.classification,
                    credits: course.credits,
                    big_type: course.big_type,
                    calendarEntry: course.calendarEntry || [],
                    courseNumber: course.courseNumber,
                  };
                })
                .filter(Boolean);
              return updatedCourses;
            });

            // Mark as set for this semester
            setHasSetLocalSelectedCourses(true);
          }

          //TODO: Actually send the study plan to the backend 05.05.2025

          setStudyPlan({
            currentPlan: foundStudyPlan,
            allPlans: studyPlansData,
            isLoading: false,
            error: null,
          });
        } else {
          console.warn("create placeholder plan for future semester");
          // Create placeholder for future semester
          const placeholderPlan = {
            id: `${semesterName} - Placeholder`,
            courses: [],
          };
          console.warn("placeholderPlan:", placeholderPlan);
          setStudyPlan((prev) => ({
            ...prev,
            currentPlan: placeholderPlan,
            isLoading: false,
          }));
        }
      } catch (error) {
        console.error("Error fetching study plan data:", error);
        setStudyPlan((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || "Failed to fetch study plan",
        }));
        errorHandlingService.handleError(error);
      }
    };

    fetchStudyPlanData();
  }, [authToken, selectedSemesterState]);

  // track if local selected courses are set
  const [hasSetLocalSelectedCourses, setHasSetLocalSelectedCourses] =
    useState(false);

  useEffect(() => {
    setHasSetLocalSelectedCourses(false);
  }, [selectedSemesterState.shortName]);

  // Once we have all course info and the study plan, set up local selected courses
  useEffect(() => {
    if (
      allCourseInfo[index] &&
      allCourseInfo[index].length > 0 &&
      !hasSetLocalSelectedCourses &&
      currentStudyPlan &&
      index != null &&
      allCourseInfo[index].length === completeCourseInfo.length
    ) {
      if (currentStudyPlan) {
        setLocalSelectedCourses((prevCourses) => {
          const updatedCourses = { ...prevCourses };
          updatedCourses[index] = currentStudyPlan.courses
            .map((courseIdentifier) => {
              // Try to find by courseNumber first (new approach), then by id (legacy approach)
              return completeCourseInfo.find(
                (course) =>
                  course.courseNumber === courseIdentifier ||
                  course.id === courseIdentifier
              );
            })
            .filter(Boolean);
          return updatedCourses;
        });

        setLocalSelectedCoursesSemKey((prevCourses) => {
          const updatedCourses = { ...prevCourses };
          const semKey = selectedSemesterState.shortName;
          updatedCourses[semKey] = currentStudyPlan.courses
            .map((courseIdentifier) => {
              // Try to find by courseNumber first (new approach), then by id (legacy approach)
              const course = completeCourseInfo.find(
                (c) =>
                  c.courseNumber === courseIdentifier ||
                  c.id === courseIdentifier
              );
              if (!course) return null;
              return {
                id: course.id,
                shortName: course.shortName,
                classification: course.classification,
                credits: course.credits,
                big_type: course.big_type,
                calendarEntry: course.calendarEntry || [],
                courseNumber: course.courseNumber, // Add courseNumber to the saved course data
              };
            })
            .filter(Boolean);
          return updatedCourses;
        });
      }
      setHasSetLocalSelectedCourses(true);
    }
  }, [
    currentStudyPlan,
    index,
    selectedSemesterState.shortName,
    hasSetLocalSelectedCourses,
    completeCourseInfo, // to force update when course info is fetched
  ]);

  // loading flags
  const [isEnrolledCoursesLoading, setIsEnrolledCoursesLoading] =
    useState(true);
  const [isCourseDataLoading, setIsCourseDataLoading] = useState(true);
  const [isCourseRatingsLoading, setIsCourseRatingsLoading] = useState(true);

  // fetch enrolled courses
  useEffect(() => {
    const fetchEnrolledCourses = async () => {
      if (
        index != null &&
        enrolledCourses &&
        (!enrolledCourses[index] || enrolledCourses[index].length === 0)
      ) {
        setIsEnrolledCoursesLoading(true);
        try {
          const response = await axios.get(
            `https://integration.unisg.ch/EventApi/MyCourses/byTerm/${selectedSemesterState.id}`,
            {
              headers: {
                "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
                "X-RequestedLanguage": "EN",
                "API-Version": "1",
                Authorization: `Bearer ${authToken}`,
              },
            }
          );
          updateEnrolledCourses(response.data, index);
        } catch (error) {
          console.error("Error fetching event list:", error);
          errorHandlingService.handleError(error);
        } finally {
          setIsEnrolledCoursesLoading(false);
        }
      } else {
        setIsEnrolledCoursesLoading(false);
      }
    };

    if (authToken && selectedSemesterState && index != null) {
      fetchEnrolledCourses();
    }
  }, [authToken, selectedSemesterState, index]);

  // fetch course data
  useEffect(() => {
    const fetchCourseData = async () => {
      if (
        index != null &&
        (!courseInfos[index] || courseInfos[index].length === 0)
      ) {
        setIsCourseDataLoading(true);
        try {
          const response = await axios.get(
            `https://integration.unisg.ch/EventApi/CourseInformationSheets/myLatestPublishedPossiblebyTerm/${cisId}`,
            {
              headers: {
                "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
                "X-RequestedLanguage": "EN",
                "API-Version": "1",
                Authorization: `Bearer ${authToken}`,
              },
            }
          );
          updateCourseInfo(response.data, index);
        } catch (error) {
          console.error("Error fetching data:", error);
          errorHandlingService.handleError(error);
        } finally {
          setIsCourseDataLoading(false);
        }
      } else {
        setIsCourseDataLoading(false);
      }
    };

    if (authToken && cisId && index != null) {
      fetchCourseData();
    }
  }, [authToken, cisId, index]);

  // fetch course ratings
  useEffect(() => {
    const fetchCourseRatings = async () => {
      if (authToken && !shsgCourseRatings) {
        setIsCourseRatingsLoading(true);
        try {
          const response = await axios({
            method: "get",
            maxBodyLength: Infinity,
            url: "https://api.shsg.ch/course-ratings",
            headers: {
              "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
              "X-RequestedLanguage": "DE",
              "API-Version": "1",
              Authorization: "Bearer " + authToken,
            },
          });
          setShsgCourseRatings(response.data);
        } catch (error) {
          console.error("Error fetching course ratings:", error);
          errorHandlingService.handleError(error);
        } finally {
          setIsCourseRatingsLoading(false);
        }
      } else {
        setIsCourseRatingsLoading(false);
      }
    };

    fetchCourseRatings();
  }, [authToken, shsgCourseRatings]);

  // update isLoading
  useEffect(() => {
    if (
      !isEnrolledCoursesLoading &&
      !isCourseDataLoading &&
      !isCourseRatingsLoading
    ) {
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
  }, [isEnrolledCoursesLoading, isCourseDataLoading, isCourseRatingsLoading]);

  // update completeCourseInfo
  useEffect(() => {
    if (allCourseInfo && allCourseInfo[index]) {
      if (allCourseInfo[index].length > 0) {
        setCompleteCourseInfo(allCourseInfo[index]);
      }
    }
  }, [allCourseInfo, index]);

  // update filteredCourses
  useEffect(() => {
    if (filteredCoursesState && index != null) {
      setFilteredCourses(filteredCoursesState[index]);
    }
  }, [filteredCoursesState, index]);

  // row renderer
  const Row = ({ index, style }) => {
    let event = null;
    if (filteredCourses < 0 && completeCourseInfo) {
      event = completeCourseInfo[index];
    } else if (filteredCourses && filteredCourses.length > 0) {
      event = filteredCourses[index];
    }
    if (!event) {
      return null;
    } else {
      const isSelected = isEventOrNestedCourseSelected(
        event,
        selectedCourseIds
      );

      // For future semesters, we should not show any enrolled courses as that's impossible
      const isFutureSemester = referenceSemesterState !== null;
      const isEnrolled = event.enrolled && !isFutureSemester;

      return (
        <div
          key={index}
          className="flex w-full h-full overflow-visible pb-2.5"
          style={style}
        >
          {/* Course Info */}
          <div
            onClick={() => {
              setSelectedCourseCourseInfo(event);
              setSelectedTabState(0);
              setIsLeftViewVisibleState(false);
            }}
            className={`flex-1 py-2 pl-3 pr-4 rounded-lg shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition duration-500 ease-in-out bg-white text-gray-800`}
          >
            <div className="pb-2 font-semibold">
              <p className="truncate">
                {event.shortName ? event.shortName : "Loading..."}
              </p>
            </div>
            <div className={`text-xs grid grid-cols-12 text-gray-700`}>
              {event && event.avgRating && (
                <p className="flex col-span-2 ">
                  <StarIcon width={12} color="#006625" /> {event.avgRating}
                </p>
              )}
              <p className="hidden col-span-2 truncate md:block">
                {event ? `${event.credits / 100} ECTS` : "NA"}
              </p>

              <p className="col-span-8 truncate">
                {event ? `${event.classification}` : "NA"}
              </p>
            </div>
          </div>

          {/* Add/Remove Button */}
          <button
            id="select_course"
            onClick={() => addOrRemoveCourse(event)}
            disabled={isEnrolled}
            className={`flex justify-center items-center h-full w-custom64 shadow-sm rounded-lg ml-3 transition duration-500 ease-in-out bg-white ${
              event.overlapping
                ? "border-warning text-warning cursor-pointer hover:shadow-md"
                : isEnrolled
                ? "border-main text-main cursor-not-allowed"
                : isSelected
                ? "border-main text-main cursor-pointer hover:shadow-md"
                : "hover:shadow-md"
            }`}
          >
            {isEnrolled ? (
              <LockClosed clg="w-6 h-6 " />
            ) : isSelected ? (
              <LockOpen
                clg="w-6 h-6 "
                selectedCourseIds={selectedCourseIds}
                setSelectedCourseIds={setSelectedCourseIds}
              />
            ) : (
              <PlusIcon className="w-6 h-6 text-gray-800 " />
            )}
          </button>
        </div>
      );
    }
  };

  Row.propTypes = {
    index: PropTypes.number.isRequired,
    style: PropTypes.object.isRequired,
  };

  const LoadingRow = ({ style }) => (
    <div style={style} className="flex items-center justify-center">
      <LoadingText>Loading courses...</LoadingText>
    </div>
  );

  LoadingRow.propTypes = {
    style: PropTypes.object.isRequired,
  };

  const NoCoursesRow = ({ style }) => (
    <div
      style={style}
      className="flex flex-col items-center justify-center space-y-2"
    >
      <p className="text-xl text-main">No matching courses found</p>
      <p className="text-sm text-main">
        or they are not yet published for your selected semester
      </p>
    </div>
  );

  NoCoursesRow.propTypes = {
    style: PropTypes.object.isRequired,
  };

  return (
    <Suspense
      fallback={<LoadingText>Loading your data from unisg.ch...</LoadingText>}
    >
      <AutoSizer>
        {({ height, width }) => (
          <FixedSizeList
            className="overflow-auto text-sm scrollbar-hide"
            height={height}
            itemCount={isLoading ? 1 : filteredCourses?.length || 1}
            itemSize={75}
            width={width}
          >
            {({ index, style }) => {
              if (isLoading) {
                return <LoadingRow style={style} />;
              }
              if (!filteredCourses || filteredCourses.length === 0) {
                return <NoCoursesRow style={style} />;
              }
              return <Row index={index} style={style} />;
            }}
          </FixedSizeList>
        )}
      </AutoSizer>
    </Suspense>
  );
}

EventListContainer.propTypes = {
  selectedSemesterState: PropTypes.object.isRequired,
};

export { EventListContainer };
