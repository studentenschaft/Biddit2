/**
 * CurriculumMap.jsx
 *
 * Main container for the long-term curriculum planning view.
 * Displays a 2D grid with semesters as rows and requirement categories as columns,
 * showing completed, enrolled, and planned courses in their appropriate cells.
 * Features nested/hierarchical category headers matching university curriculum structure.
 *
 * Drag-and-drop: DndContext is provided at the parent level (Biddit2.jsx) to enable
 * cross-component dragging from EventListContainer to CurriculumMap.
 */

import { useRecoilValue } from "recoil";
import { useState, useEffect } from "react";
import { DownloadIcon, ArrowLeftIcon } from "@heroicons/react/solid";
import { curriculumMapSelector } from "../../recoil/curriculumMapSelector";
import { authTokenState } from "../../recoil/authAtom";
import { curriculumPlansRegistryState } from "../../recoil/curriculumPlansRegistryAtom";
import { useScorecardFetching } from "../../helpers/useScorecardFetching";
import { useInitializeScoreCards } from "../../helpers/useInitializeScorecards";
import usePlanManager from "../../helpers/usePlanManager";
import { useErrorHandler } from "../../errorHandling/useErrorHandler";
import LoadingText from "../../common/LoadingText";
import CurriculumGrid from "./CurriculumGrid";
import ProgramHeader from "./ProgramHeader";
import PlanSwitcher from "./PlanSwitcher";
import PlaceholderCreator from "./PlaceholderCreator";
import CategoryLegend from "./CategoryLegend";
import CurriculumMapTutorial, {
  TUTORIAL_STORAGE_KEY,
} from "./CurriculumMapTutorial";

const DRAG_HINT_STORAGE_KEY = "biddit-curriculum-drag-hint-dismissed";

/**
 * Animated hint showing users they can drag courses from the left panel
 */
const DragHint = ({ onDismiss }) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm">
      {/* Animated arrow pointing left */}
      <div className="flex items-center animate-bounce-horizontal">
        <ArrowLeftIcon className="w-5 h-5 text-blue-500" />
      </div>

      <div className="flex-1 text-sm text-blue-700">
        <span className="font-medium">Drag courses</span>
        <span className="text-blue-600">
          {" "}
          from the Course List on the left into the grid. To get all your previously saved courses into the Curriculum map, click {" "}
        </span>
        <span className="font-medium">"Import Selected Courses"</span>
        <span className="text-blue-600">
          .
        </span>
      </div>

      <button
        onClick={() => {
          setIsVisible(false);
          localStorage.setItem(DRAG_HINT_STORAGE_KEY, "true");
          onDismiss?.();
        }}
        className="text-blue-400 hover:text-blue-600 text-xs font-medium px-2 py-1 rounded hover:bg-blue-100 transition-colors"
      >
        Got it
      </button>
    </div>
  );
};

const CurriculumMap = () => {
  const curriculumData = useRecoilValue(curriculumMapSelector);
  const authToken = useRecoilValue(authTokenState);
  const plansRegistry = useRecoilValue(curriculumPlansRegistryState);
  const { loadPlans, importSelectedCourses } = usePlanManager();
  const scorecardFetching = useScorecardFetching();
  const handleError = useErrorHandler();
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showDragHint, setShowDragHint] = useState(
    () => localStorage.getItem(DRAG_HINT_STORAGE_KEY) !== "true",
  );
  const [tutorialOpen, setTutorialOpen] = useState(
    () => localStorage.getItem(TUTORIAL_STORAGE_KEY) !== "true",
  );
  // Click-to-place is disabled; placementMode stays null. Grid still receives
  // it so re-enabling later only requires restoring the useState + handlers.
  const placementMode = null;

  // Handle import button click
  const handleImportCourses = async () => {
    setIsImporting(true);
    try {
      await importSelectedCourses();
    } finally {
      setIsImporting(false);
    }
  };

  // Initialize scorecard data
  useInitializeScoreCards(handleError);

  // Load curriculum plans from API on mount (if not already loaded)
  useEffect(() => {
    if (!plansRegistry.isLoaded && authToken) {
      loadPlans();
    }
  }, [plansRegistry.isLoaded, authToken, loadPlans]);

  // Auto-fetch if needed
  useEffect(() => {
    const fetchIfNeeded = async () => {
      if (!curriculumData.isLoaded && !fetchAttempted && authToken) {
        setFetchAttempted(true);
        try {
          await scorecardFetching.fetchAll(authToken);
        } catch (error) {
          console.error("[CurriculumMap] Error fetching scorecard:", error);
        }
      }
    };
    fetchIfNeeded();
  }, [curriculumData.isLoaded, fetchAttempted, authToken, scorecardFetching]);

  // Loading state
  if (!curriculumData.isLoaded || !plansRegistry.isLoaded) {
    return (
      <div className="flex flex-col h-full px-6 py-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">
          Curriculum Map
        </h1>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-64 mx-auto mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-48 mx-auto mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-56 mx-auto"></div>
            </div>
            <LoadingText>
              {!plansRegistry.isLoaded
                ? "Loading your curriculum plans..."
                : "Loading curriculum data..."}
            </LoadingText>
          </div>
        </div>
      </div>
    );
  }

  // No program data
  if (!curriculumData.program) {
    return (
      <div className="flex flex-col h-full px-6 py-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">
          Curriculum Map
        </h1>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-8 bg-gradient-to-br from-hsg-50 to-blue-50 rounded-lg border border-hsg-200 max-w-md p-6">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              No Academic Data Found
            </h3>
            <p className="text-gray-600">
              Load your study data from the Study Overview tab to see your
              curriculum map.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CurriculumMapTutorial
        isOpen={tutorialOpen}
        onDismiss={() => {
          localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
          setTutorialOpen(false);
        }}
      />
      {/* Header with program info and progress */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
        <ProgramHeader
          program={curriculumData.program}
          onHelpClick={() => setTutorialOpen(true)}
        />
        <div className="flex items-center gap-4 flex-wrap">
          <PlanSwitcher />
          <button
            onClick={handleImportCourses}
            disabled={isImporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-hsg-600 hover:bg-hsg-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors shadow-sm"
            title="Import selected courses from your study plan into this curriculum plan"
          >
            <DownloadIcon className="w-4 h-4" />
            {isImporting ? "Importing..." : "Import Selected Courses"}
          </button>
        </div>
        <PlaceholderCreator />
      </div>

      {/* Main content area: grid (courses are dragged from EventListContainer) */}
      <div className="flex-1 overflow-auto scrollbar-thin-visible px-6 py-4">
        {/* Drag hint - shows animation to guide users */}
        {showDragHint && (
          <div className="mb-4">
            <DragHint onDismiss={() => setShowDragHint(false)} />
          </div>
        )}

        <CurriculumGrid
          categories={curriculumData.flatCategories}
          categoryHierarchy={curriculumData.categoryHierarchy}
          semesters={curriculumData.semesters}
          coursesBySemesterAndCategory={
            curriculumData.coursesBySemesterAndCategory
          }
          validations={curriculumData.validations}
          placementMode={placementMode}
        />
      </div>

      {/* Legend at bottom */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50">
        <CategoryLegend />
      </div>
    </div>
  );
};

export default CurriculumMap;
