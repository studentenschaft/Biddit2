/**
 * EventListContainer Component - SIMPLIFIED VERSION
 *
 * Displays a virtualized list of university courses with simplified data flow.
 *
 * SIMPLIFIED CHANGES:
 * - Receives termListObject instead of complex selectedSemesterState
 * - Uses unified course selectors directly for course display
 * - Removes legacy index-based logic and intermediate states
 * - Only updates unifiedCourseDataAtom through unified hooks
 *
 * NEW FLOW:
 * 1. Receives termListObject from parent (from useTermSelection)
 * 2. Uses useEventListDataManager for data coordination
 * 3. Gets filtered courses directly from unified course selectors
 * 4. Displays courses using existing Row component logic
 */

import PropTypes from "prop-types";
import { useRecoilState, useRecoilValue } from "recoil";
import { Suspense } from "react";
import { authTokenState } from "../../recoil/authAtom";
import { selectionOptionsState } from "../../recoil/selectionOptionsAtom";
import { FixedSizeList } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import LoadingText from "../../common/LoadingText";

// Unified course selectors - PRIMARY DATA SOURCE
import { semesterCoursesSelector } from "../../recoil/unifiedCourseDataSelectors";

// Simplified data management hooks
import { useEventListDataManager } from "../../helpers/useEventListDataManager";
import { useCourseSelection } from "../../helpers/useCourseSelection";

// Icons
import { PlusIcon } from "@heroicons/react/outline";
import { StarIcon } from "@heroicons/react/solid";

// Custom components
import { LockClosed } from "./LockClosed";
import { LockOpen } from "./LockOpen";

// Recoil state
import { selectedTabAtom } from "../../recoil/selectedTabAtom";
import { selectedCourseCourseInfo } from "../../recoil/selectedCourseCourseInfo";
import { isLeftViewVisible } from "../../recoil/isLeftViewVisible";
import { selectedCourseIdsAtom } from "../../recoil/selectedCourseIdsAtom";

// Helper function - moved here for simplicity
function isEventOrNestedCourseSelected(event, selectedCourseIds) {
  // Safety check to avoid NULL error:
  if (!Array.isArray(selectedCourseIds)) {
    console.warn("selectedCourseIds is not an array:", selectedCourseIds);
    return false;
  }
  // Check if the top-level event.id matches
  if (
    selectedCourseIds.includes(event.id) ||
    selectedCourseIds.includes(event.courseNumber) ||
    selectedCourseIds.includes(event.courses?.[0]?.courseNumber)
  )
    return true;

  return false;
}

export default function EventListContainer({
  termListObject,
  selectedSemesterShortName,
}) {
  // Simplified recoil state
  const authToken = useRecoilValue(authTokenState);
  const selectionOptions = useRecoilValue(selectionOptionsState);
  const [selectedCourseIds, setSelectedCourseIds] = useRecoilState(
    selectedCourseIdsAtom
  );
  const [, setSelectedTabState] = useRecoilState(selectedTabAtom);
  const [, setSelectedCourseCourseInfo] = useRecoilState(
    selectedCourseCourseInfo
  );
  const [, setIsLeftViewVisibleState] = useRecoilState(isLeftViewVisible);

  // Get selected semester object from termListObject
  const selectedSemester = termListObject?.find(
    (semester) => semester.shortName === selectedSemesterShortName
  );

  // Use simplified data manager
  const { isLoading } = useEventListDataManager(
    selectedSemester,
    selectionOptions,
    authToken
  );

  // Get filtered courses directly from unified selectors
  const filteredCourses =
    useRecoilValue(
      semesterCoursesSelector({
        semester: selectedSemesterShortName,
        type: "filtered",
      })
    ) || [];

  console.log("filteredCourses:", filteredCourses);

  // Course selection hook (simplified)
  const { addOrRemoveCourse } = useCourseSelection({
    selectedCourseIds,
    setSelectedCourseIds,
    selectedSemesterShortName: selectedSemesterShortName || "",
    authToken,
  });

  // Row renderer - simplified to use only filtered courses
  const Row = ({ index, style }) => {
    const event = filteredCourses[index];

    if (!event) {
      return null;
    }

    const isSelected = isEventOrNestedCourseSelected(event, selectedCourseIds);

    // For projected semesters, we should not show any enrolled courses as locked
    const isEnrolled = event.enrolled && !selectedSemester?.isProjected;

    // For projected semesters, check if course was previously enrolled (for visual indication)
    const wasPreviouslyEnrolled =
      event.enrolled && selectedSemester?.isProjected;

    return (
      <div
        key={index}
        className="flex w-full h-full overflow-visible pb-2.5"
        style={style}
        title={
          wasPreviouslyEnrolled
            ? "This course was enrolled in a previous semester and probably should not be taken again unless retaking"
            : ""
        }
      >
        {/* Course Info */}
        <div
          onClick={() => {
            setSelectedCourseCourseInfo(event);
            setSelectedTabState(0);
            setIsLeftViewVisibleState(false);
          }}
          className={`flex-1 py-2 pl-3 pr-4 rounded-lg shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition duration-500 ease-in-out ${
            wasPreviouslyEnrolled
              ? "bg-gray-100 text-gray-500"
              : "bg-white text-gray-800"
          }`}
        >
          <div className="pb-2 font-semibold">
            <p className="truncate">
              {event.shortName ? event.shortName : "Loading..."}
            </p>
          </div>
          <div
            className={`text-xs grid grid-cols-12 ${
              wasPreviouslyEnrolled ? "text-gray-400" : "text-gray-700"
            }`}
          >
            {event && event.avgRating && (
              <p className="flex col-span-2 ">
                <StarIcon
                  width={12}
                  color={wasPreviouslyEnrolled ? "#9CA3AF" : "#006625"}
                />{" "}
                {event.avgRating}
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
          className={`flex justify-center items-center h-full w-custom64 shadow-sm rounded-lg ml-3 transition duration-500 ease-in-out ${
            wasPreviouslyEnrolled
              ? "bg-gray-100 border-gray-300 text-gray-400"
              : "bg-white"
          } ${
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
            <PlusIcon
              className={`w-6 h-6 ${
                wasPreviouslyEnrolled ? "text-gray-400" : "text-gray-800"
              }`}
            />
          )}
        </button>
      </div>
    );
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
  termListObject: PropTypes.arrayOf(
    PropTypes.shape({
      cisId: PropTypes.string.isRequired,
      id: PropTypes.string.isRequired,
      shortName: PropTypes.string.isRequired,
      isCurrent: PropTypes.bool.isRequired,
      isProjected: PropTypes.bool.isRequired,
      isFuture: PropTypes.bool, // Optional property for artificially generated future semesters
    })
  ).isRequired,
  selectedSemesterShortName: PropTypes.string.isRequired,
};

export { EventListContainer };
