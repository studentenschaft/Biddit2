import { Suspense, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { SelectSemester } from "../components/leftCol/topRow/SelectOptions";
import { SideNav } from "../components/leftCol/sideNav/SideNav";
import { MobileNavDrawer } from "../components/leftCol/sideNav/MobileNavDrawer";

// Recoil
import { useRecoilState } from "recoil";
import { selectedTabAtom } from "../components/recoil/selectedTabAtom";
import { tabIndexOf } from "../constants/tabs";
import { makeTabSelectHandler } from "./tabSelectHandler";

// DnD Kit for drag-and-drop between EventListContainer and CurriculumMap
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useCurriculumPlan } from "../components/helpers/useCurriculumPlan";

/**
 * Format credits for display, handling both "cents" format (300 = 3 ECTS)
 * and already-normalized format (3 = 3 ECTS)
 */
const formatCredits = (credits, isNormalized = false) => {
  if (!credits) return "?";
  const value = isNormalized ? credits : credits / 100;
  return value.toFixed(Number.isInteger(value) ? 0 : 1);
};

// Styles
import "./react-tabs.css";
import LoadingText from "../components/common/LoadingText";
import IaChangeNotice from "../components/common/IaChangeNotice";
import { InformationCircleIcon, XCircleIcon } from "@heroicons/react/solid";

// Tab & Contents
import { TabComponent } from "./TabComponent";

//mobile view
import { isLeftViewVisible } from "../components/recoil/isLeftViewVisible";

/**
 * DragPreviewCard - Visual preview during drag operations
 */
const DragPreviewCard = ({ item, type }) => {
  if (!item) return null;

  const isGridCourse = type === "grid-course" || type === "placeholder-creator";

  // Grid courses have already-normalized credits (in ECTS)
  // EventList and Picker courses have credits in "cents" format (300 = 3 ECTS)
  const name =
    item.shortName ||
    item.courseNumber ||
    item.name ||
    item.courseId ||
    item.id;
  const credits = formatCredits(item.credits, isGridCourse);
  const displayName = name?.length > 30 ? name.substring(0, 28) + "..." : name;

  return (
    <div className="bg-blue-100 border-2 border-blue-500 rounded px-3 py-2 text-sm shadow-lg cursor-grabbing">
      <div className="font-medium text-blue-900">{displayName}</div>
      <div className="text-xs text-blue-700">{credits} ECTS</div>
    </div>
  );
};

DragPreviewCard.propTypes = {
  item: PropTypes.object,
  type: PropTypes.string,
};

export default function Biddit2() {
  const [selectedTabState, setSelectedTabState] =
    useRecoilState(selectedTabAtom);
  const [isSideNavOpen, setIsSideNavOpen] = useState(false);
  const closeSideNav = useCallback(() => setIsSideNavOpen(false), []);
  // for mobile view
  const [isLeftViewVisibleState, setIsLeftViewVisibleState] =
    useRecoilState(isLeftViewVisible);

  // Drag-and-drop state for cross-component dragging
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [activeDragType, setActiveDragType] = useState(null);
  const {
    addCourse,
    addPlaceholder,
    moveCourse,
    removeCourse,
    movePlaceholder,
    removePlaceholder,
  } = useCurriculumPlan();

  // Configure drag sensors with activation constraint to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  /**
   * Handle drag start - capture the dragged item for DragOverlay
   */
  const handleDragStart = useCallback((event) => {
    const { active } = event;
    const dragData = active.data.current;

    if (dragData?.type === "eventlist-course") {
      setActiveDragItem(dragData.course);
      setActiveDragType("eventlist-course");
    } else if (dragData?.type === "grid-course") {
      setActiveDragItem(dragData.item);
      setActiveDragType("grid-course");
    } else if (dragData?.type === "placeholder-creator") {
      setActiveDragItem({
        name: dragData.label,
        credits: dragData.credits,
        isPlaceholder: true,
      });
      setActiveDragType("placeholder-creator");
    }
  }, []);

  /**
   * Handle drag end - process the drop
   */
  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;

      // Reset drag state
      setActiveDragItem(null);
      setActiveDragType(null);

      const dragData = active.data.current;

      // No valid drop target - check if we should remove a grid course
      if (!over) {
        // If dragging a grid course and dropped outside any target, remove it
        if (dragData?.type === "grid-course") {
          const { item } = dragData;
          if (item.isPlaceholder) {
            await removePlaceholder(item.id);
          } else {
            const courseId = item.courseId || item.id;
            await removeCourse(courseId, { source: dragData.source, semesterKey: dragData.semesterKey });
          }
        }
        return;
      }

      const dropData = over.data.current;

      // Validate drop target has required properties (is a grid cell)
      const isValidGridCell = dropData?.semesterKey && dropData?.categoryPath;

      // Handle grid course dropped on non-grid target (remove it)
      if (dragData?.type === "grid-course" && !isValidGridCell) {
        const { item } = dragData;
        if (item.isPlaceholder) {
          await removePlaceholder(item.id);
        } else {
          const courseId = item.courseId || item.id;
          await removeCourse(courseId, { source: dragData.source, semesterKey: dragData.semesterKey });
        }
        return;
      }

      // From here, we need a valid grid cell
      if (!isValidGridCell) return;

      // Reject drops to completed semesters
      if (
        dropData.canDrop === false ||
        dropData.semesterStatus === "completed"
      ) {
        if (import.meta.env.DEV) {
          console.log("[Biddit2] Drop rejected: completed semester");
        }
        return;
      }

      // Handle placeholder from PlaceholderCreator
      if (dragData?.type === "placeholder-creator") {
        const { credits, label } = dragData;
        const { semesterKey: targetSemester, categoryPath } = dropData;
        await addPlaceholder(targetSemester, categoryPath, credits, label);
        return;
      }

      // Handle course from EventListContainer
      if (dragData?.type === "eventlist-course") {
        const { course } = dragData;
        const { semesterKey: targetSemester, categoryPath } = dropData;
        await addCourse(course, targetSemester, categoryPath);
        return;
      }

      // Handle course from grid (move between cells)
      if (dragData?.type === "grid-course") {
        const {
          item,
          semesterKey: sourceSemester,
          categoryPath: sourceCategory,
        } = dragData;
        const { semesterKey: targetSemester, categoryPath: targetCategory } =
          dropData;

        // Same cell = no-op (check BOTH semester AND category)
        if (
          sourceSemester === targetSemester &&
          sourceCategory === targetCategory
        ) {
          return;
        }

        if (item.isPlaceholder) {
          await movePlaceholder(
            item.id,
            sourceSemester,
            targetSemester,
            targetCategory,
          );
        } else {
          const courseId = item.courseId || item.id;
          await moveCourse(
            courseId,
            sourceSemester,
            targetSemester,
            targetCategory,
          );
        }
      }
    },
    [
      addCourse,
      addPlaceholder,
      moveCourse,
      removeCourse,
      movePlaceholder,
      removePlaceholder,
    ],
  );

  /**
   * Handle drag cancel
   */
  const handleDragCancel = useCallback(() => {
    setActiveDragItem(null);
    setActiveDragType(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* mt-/h- offset reserves space below the fixed DegradedModeBanner
          (see its HEIGHT_CSS_VAR); the var defaults to 0px so this is a
          no-op when the banner is hidden. */}
      <div className="flex flex-col md:flex-row w-full overflow-hidden mt-[var(--degraded-banner-height,0px)] h-[calc(100vh-var(--degraded-banner-height,0px))]">
        {/* Mobile Menu Button — z-[54] keeps it above the drawer's z-[52]
            backdrop and z-[53] panel, so it stays the visible close control
            while the drawer is open. The whole band sits above the in-page
            z-50 layer because AnalyticsNotice (the fixed cookie notice) lives
            there and used to paint over the backdrop; see MobileNavDrawer.jsx
            for the full ladder. */}
        <div className="md:hidden fixed bottom-10 left-0 z-[54] p-4 ">
          <button
            aria-label={isSideNavOpen ? "Close menu" : "Open menu"}
            onClick={() => setIsSideNavOpen(!isSideNavOpen)}
            className="p-2 rounded-md bg-white shadow-lg "
          >
            {!isSideNavOpen ? (
              <InformationCircleIcon className="h-6 w-6 text-green-700" />
            ) : (
              <XCircleIcon className="h-6 w-6 text-red-700" />
            )}
          </button>
        </div>
        {/* Side Navigation — the static rail, desktop only. Below md it must
            never be in flow: as a flex child of this flex-col root it rendered
            as a full-width block above the content. The phone gets the overlay
            drawer below instead. */}
        <div className="hidden md:block">
          <SideNav />
        </div>
        <MobileNavDrawer open={isSideNavOpen} onClose={closeSideNav} />
        {/* Mobile View Toggle */}
        <div className="md:hidden fixed bottom-0 w-full bg-hsg-800 flex justify-around p-2 z-20 shadow-lg">
          <button
            onClick={() => setIsLeftViewVisibleState(true)}
            className={`flex-1 mx-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ease-in-out
                ${
                  isLeftViewVisibleState
                    ? "bg-white text-hsg-800 shadow-sm"
                    : "bg-transparent text-white hover:bg-hsg-700"
                }`}
          >
            Course List
          </button>
          <button
            onClick={() => setIsLeftViewVisibleState(false)}
            className={`flex-1 mx-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ease-in-out
                ${
                  !isLeftViewVisibleState
                    ? "bg-white text-hsg-800 shadow-sm"
                    : "bg-transparent text-white hover:bg-hsg-700"
                }`}
          >
            Tabs
          </button>
        </div>
        {/* Content */}
        <div
          className={`w-full h-full md:w-1/3 p-4 bg-gray-100 overflow-hidden min-w-0 flex flex-col ${
            !isLeftViewVisibleState ? "hidden md:flex" : ""
          }`}
        >
          <Suspense
            fallback={<LoadingText>Loading Course Data...</LoadingText>}
          >
            <SelectSemester />
          </Suspense>
        </div>
        <div
          className={`w-full h-full md:w-2/3 p-4 bg-white overflow-y-auto md:overflow-y-auto min-w-0 flex flex-col ${
            isLeftViewVisibleState ? "hidden md:flex" : ""
          }`}
        >
          <IaChangeNotice />
          <Suspense
            fallback={<LoadingText>Loading dynamic Tab Text...</LoadingText>}
          >
            <TabComponent
              selectedTab={tabIndexOf(selectedTabState)}
              onTabSelect={makeTabSelectHandler(
                selectedTabState,
                setSelectedTabState
              )}
            />
          </Suspense>
        </div>
      </div>

      {/* Drag overlay - follows cursor during drag */}
      <DragOverlay>
        {activeDragItem && (
          <DragPreviewCard item={activeDragItem} type={activeDragType} />
        )}
      </DragOverlay>
    </DndContext>
  );
}

export { Biddit2 };
