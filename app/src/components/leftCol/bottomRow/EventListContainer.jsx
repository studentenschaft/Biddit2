/**
 * EventListContainer Component
 * manages and displays a virtualized list of university courses
 * Key features:
 * - Fetches and displays enrolled courses for a selected semester
 * - Shows course ratings from SHSG API
 * - Implements virtual scrolling for performance
 * - Filters courses based on user selection (DUAL SYSTEM: Legacy + Unified)
 * - Handles course enrollment status
 * - allows for adding courses to the user's schedule (TODO)
 *
 * MIGRATION STATUS:
 * ✅ REFACTORED: Split data fetching into organized helper hooks
 * ✅ MAINTAINED: Same flow and order of operations
 * ✅ INTEGRATED: Now uses unified course selectors for filtered courses display
 * ✅ COMPATIBLE: Both filtering systems work together during migration period
 * ✅ IMPROVED: Direct selector usage eliminates intermediate state management
 *
 * The component now uses:
 * - NEW: semesterCoursesSelector for filtered courses (primary display source)
 * - Fallback: completeCourseInfo when unified filtered courses not ready
 * - Unified: updateUnifiedFilteredCourses from useUnifiedCourseData (background processing)
 * - Organized: Helper hooks for data management (useEventListDataManager)
 */

import PropTypes from "prop-types";
import { useRecoilState, useRecoilValue } from "recoil";
import { useEffect, Suspense } from "react";
import { authTokenState } from "../../recoil/authAtom";
import { allCourseInfoState } from "../../recoil/allCourseInfosSelector";
import { FixedSizeList } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import LoadingText from "../../common/LoadingText";
import { cisIdListSelector } from "../../recoil/cisIdListSelector";

// Unified course selectors - NEW APPROACH
import { semesterCoursesSelector } from "../../recoil/courseSelectors";

// Data management hooks - NEW REFACTORED APPROACH
import { useEventListDataManager } from "../../helpers/useEventListDataManager";
import { useCourseSelection } from "../../helpers/useCourseSelection";

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

// Missing recoil atoms
import { selectedCourseIdsAtom } from "../../recoil/selectedCourseIdsAtom";
import {
  isFutureSemesterSelected,
  referenceSemester,
} from "../../recoil/isFutureSemesterSelected";

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
  // Recoil values and state hooks - Simplified after refactoring
  const authToken = useRecoilValue(authTokenState);
  const allCourseInfo = useRecoilValue(allCourseInfoState);
  const [selectedCourseIds, setSelectedCourseIds] = useRecoilState(
    selectedCourseIdsAtom
  );
  const cisIdList = useRecoilValue(cisIdListSelector);
  const [, setIsFutureSemesterSelected] = useRecoilState(
    isFutureSemesterSelected
  );
  const [referenceSemesterState, setReferenceSemesterState] =
    useRecoilState(referenceSemester);
  const [, setSelectedTabState] = useRecoilState(selectedTabAtom);
  const [, setSelectedCourseCourseInfo] = useRecoilState(
    selectedCourseCourseInfo
  );
  const [localSelectedBySemester] = useRecoilState(
    localSelectedCoursesSemKeyState
  );
  const [, setIsLeftViewVisibleState] = useRecoilState(isLeftViewVisible);

  // Calculate semester identifiers
  let cisId = null;
  let index = null;
  if (selectedSemesterState) {
    cisId = selectedSemesterState.cisId;
    index = selectedSemesterState.index;

    // Handle future semester selection
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
  // NEW: Use the refactored data manager hook
  const { completeCourseInfo, isLoading } = useEventListDataManager({
    authToken,
    selectedSemesterState,
    index,
    cisId,
  });
  // NEW: Use unified course selector for filtered courses
  const unifiedFilteredCourses = useRecoilValue(
    semesterCoursesSelector({
      semester: selectedSemesterState?.shortName,
      type: "filtered",
    })
  );

  // Fallback to completeCourseInfo if unified filtered courses are not available yet
  const filteredCourses =
    unifiedFilteredCourses?.length > 0
      ? unifiedFilteredCourses
      : completeCourseInfo;

  // Course selection hook (unchanged)
  const { addOrRemoveCourse } = useCourseSelection({
    selectedCourseIds,
    setSelectedCourseIds,
    selectedSemesterShortName: selectedSemesterState?.shortName || "",
    index,
    authToken,
  });

  // Debug effect for localSelectedBySemester (unchanged)
  useEffect(() => {
    console.log(
      "DEBUG: localSelectedBySemester changed",
      localSelectedBySemester
    );
  }, [localSelectedBySemester]);

  // row renderer
  const Row = ({ index, style }) => {
    let event = null;
    if (
      (!filteredCourses || filteredCourses.length <= 0) &&
      completeCourseInfo
    ) {
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
