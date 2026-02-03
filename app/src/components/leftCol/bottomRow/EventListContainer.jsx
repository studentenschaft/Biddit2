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
import { useEffect, useRef } from "react";
import { authTokenState } from "../../recoil/authAtom";
import { selectionOptionsState } from "../../recoil/selectionOptionsAtom";
import { FixedSizeList } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import LoadingText from "../../common/LoadingText";

// DnD Kit for drag-and-drop to CurriculumMap
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

// Simplified data management hooks
import { useEventListDataManager } from "../../helpers/useEventListDataManager";
import { useCourseSelection } from "../../helpers/useCourseSelection";
import { useUnifiedCourseData } from "../../helpers/useUnifiedCourseData";

// Unified course selectors - PRIMARY DATA SOURCE
import {
  semesterCoursesSelector,
  selectedCoursesSelector,
} from "../../recoil/unifiedCourseDataSelectors";

// Icons
import { PlusIcon } from "@heroicons/react/outline";
import { StarIcon } from "@heroicons/react/solid";
import { Tooltip as ReactTooltip } from "react-tooltip";

// Custom components
import { LockClosed } from "./LockClosed";
import { LockOpen } from "./LockOpen";

// Recoil state
import { selectedTabAtom } from "../../recoil/selectedTabAtom";
import { isLeftViewVisible } from "../../recoil/isLeftViewVisible";

// Helper function - moved here for simplicity
// Now uses the 'selected' property from filtered courses instead of separate selectedCourseIds
function isEventOrNestedCourseSelected(event) {
  // The filtered courses already have the 'selected' property set by updateFilteredCourses
  return event.selected || false;
}

export default function EventListContainer({
  termListObject,
  selectedSemesterShortName,
}) {
  // Simplified recoil state
  const authToken = useRecoilValue(authTokenState);
  const selectionOptions = useRecoilValue(selectionOptionsState);
  const [, setSelectedTabState] = useRecoilState(selectedTabAtom);
  const [, setIsLeftViewVisibleState] = useRecoilState(isLeftViewVisible);

  // Use unified course data for managing selected course info
  const { updateSelectedCourseInfo, courseData } = useUnifiedCourseData();

  // Get selected semester object from termListObject
  const selectedSemester = termListObject?.find(
    (semester) => semester.shortName === selectedSemesterShortName
  );

  // Get selected course IDs from unified state
  const selectedCourseIds =
    useRecoilValue(selectedCoursesSelector(selectedSemesterShortName)) || [];

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

  /**
   * ========================= DEV LOGGING UTILITIES =========================
   * Provides short summary lines plus expandable full objects for quick inspection
   * Only runs in development mode (NODE_ENV === 'development') to avoid prod noise.
   */
  const lastLogSnapshotRef = useRef(null);

  const buildSemesterSummary = (semData) => {
    if (!semData) return "<no semester data>";
    return `enrolledIds:${semData.enrolledIds?.length || 0} available:${
      semData.available?.length || 0
    } selectedIds:${semData.selectedIds?.length || 0} filtered:${
      semData.filtered?.length || 0
    } studyPlan:${semData.studyPlan?.length || 0}`;
  };

  const shallowSummary = () => {
    const semesterData = courseData?.semesters?.[selectedSemesterShortName];
    return {
      semester: selectedSemesterShortName,
      filteredCount: filteredCourses.length,
      selectedCount: selectedCourseIds.length,
      isLoading,
      semesterSnapshot: buildSemesterSummary(semesterData),
    };
  };

  const logAtomSummary = () => {
    if (!import.meta.env.DEV) return; // dev only
    try {
      const summary = shallowSummary();
      // Avoid duplicate logs by hashing snapshot
      const snapshotKey = JSON.stringify({
        f: summary.filteredCount,
        s: summary.selectedCount,
        l: summary.isLoading,
        sem: summary.semesterSnapshot,
      });
      if (lastLogSnapshotRef.current === snapshotKey) return; // no change
      lastLogSnapshotRef.current = snapshotKey;

      const semesterData = courseData?.semesters?.[selectedSemesterShortName];
      const groupLabel = `📋 EventListContainer @${selectedSemesterShortName} | filtered:${summary.filteredCount} selected:${summary.selectedCount} loading:${summary.isLoading}`;
      // Collapsed group keeps console tidy
      console.groupCollapsed(groupLabel);
      console.log("Term List (len)", termListObject?.length, termListObject);
      console.log("Selection Options", selectionOptions);
      console.log(
        "Auth Token (truncated)",
        authToken ? authToken.slice(0, 8) + "…" : null
      );
      console.log("Selected Course IDs", selectedCourseIds);
      console.log("Filtered Courses (first 5)", filteredCourses.slice(0, 5));
      console.log("Semester Data Summary", summary.semesterSnapshot);
      console.log("Full Semester Data", semesterData);
      console.log(
        "Unified Course Data (keys)",
        Object.keys(courseData?.semesters || {})
      );
      console.groupEnd();
    } catch (e) {
      console.warn("[EventListContainer] Dev logging failed", e);
    }
  };

  // Log whenever core inputs change
  const enrolledCount =
    courseData?.semesters?.[selectedSemesterShortName]?.enrolledIds?.length ||
    0;
  useEffect(() => {
    logAtomSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedSemesterShortName,
    filteredCourses.length,
    selectedCourseIds.length,
    isLoading,
    enrolledCount,
  ]);

  // Expose manual trigger for console via window for deeper inspection
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__BIDDIT_DEBUG = window.__BIDDIT_DEBUG || {};
    window.__BIDDIT_DEBUG.logEventListAtoms = logAtomSummary;
    return () => {
      if (window.__BIDDIT_DEBUG) {
        delete window.__BIDDIT_DEBUG.logEventListAtoms;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ======================= END DEV LOGGING UTILITIES =======================

  // Course selection hook (simplified) - now works with unified state
  const { addOrRemoveCourse } = useCourseSelection({
    selectedCourseIds,
    setSelectedCourseIds: null, // Not needed anymore - hook will update unified state directly
    selectedSemesterShortName: selectedSemesterShortName || "",
    authToken,
  });

  // Row renderer - simplified to use only filtered courses
  // Now includes drag capability for CurriculumMap integration
  const Row = ({ index, style, data }) => {
    const event = data.filteredCourses[index];
    const courseId = event?.courseNumber || event?.id || `row-${index}`;

    // useDraggable hook for drag-and-drop (must be called unconditionally)
    const { attributes, listeners, setNodeRef, transform, isDragging } =
      useDraggable({
        id: `eventlist-${courseId}`,
        data: {
          type: "eventlist-course",
          course: event,
          semesterKey: data.selectedSemesterShortName,
        },
        disabled: !event, // Disable dragging if no event
      });

    // Early return after hooks
    if (!event) {
      return null;
    }

    // Apply transform during drag
    const dragStyle = transform
      ? { transform: CSS.Translate.toString(transform) }
      : {};

    const isSelected = isEventOrNestedCourseSelected(event);

    // For projected semesters, we should not show any enrolled courses as locked
    const isEnrolled = event.enrolled && !data.selectedSemester?.isProjected;

    // For projected semesters, check if course was previously enrolled (for visual indication)
    const wasPreviouslyEnrolled =
      event.enrolled && data.selectedSemester?.isProjected;

    return (
      <div
        ref={setNodeRef}
        key={index}
        className={`flex w-full h-full overflow-visible pb-2.5 ${
          isDragging ? "opacity-50" : ""
        }`}
        style={{ ...style, ...dragStyle }}
        title={
          wasPreviouslyEnrolled
            ? "This course was enrolled in a previous semester and probably should not be taken again unless retaking"
            : ""
        }
      >
        {/* Course Info - draggable area */}
        <div
          {...listeners}
          {...attributes}
          onClick={() => {
            data.updateSelectedCourseInfo(event);
            data.setSelectedTabState(0);
            data.setIsLeftViewVisibleState(false);
          }}
          className={`flex-1 py-2 pl-3 pr-4 rounded-lg shadow-sm overflow-hidden cursor-grab hover:shadow-md transition duration-500 ease-in-out ${
            wasPreviouslyEnrolled
              ? "bg-gray-100 text-gray-500"
              : "bg-white text-gray-800"
          } ${isDragging ? "cursor-grabbing" : ""}`}
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
          onClick={() => data.addOrRemoveCourse(event)}
          disabled={isEnrolled}
          data-tooltip-id={isEnrolled ? "enrolled-tooltip" : undefined}
          data-tooltip-content={isEnrolled ? "You are already enrolled in this course" : undefined}
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
            <LockClosed clg="w-6 h-6 " event={event} />
          ) : isSelected ? (
            <LockOpen
              clg="w-6 h-6 "
              event={event}
              selectedCourseIds={data.selectedCourseIds}
              setSelectedCourseIds={null} // Not needed anymore
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
    data: PropTypes.object.isRequired,
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

  // Prepare itemData for Row component (includes all needed callbacks and state)
  const itemData = {
    filteredCourses,
    selectedSemesterShortName,
    selectedSemester,
    selectedCourseIds,
    updateSelectedCourseInfo,
    setSelectedTabState,
    setIsLeftViewVisibleState,
    addOrRemoveCourse,
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
            itemData={itemData}
          >
            {({ index, style, data }) => {
              if (isLoading) {
                return <LoadingRow style={style} />;
              }
              if (!filteredCourses || filteredCourses.length === 0) {
                return <NoCoursesRow style={style} />;
              }
              return <Row index={index} style={style} data={data} />;
            }}
          </FixedSizeList>
        )}
      </AutoSizer>
      <ReactTooltip
        id="enrolled-tooltip"
        place="top"
        effect="solid"
        className="bg-gray-800 text-white text-xs rounded px-2 py-1"
      />
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
