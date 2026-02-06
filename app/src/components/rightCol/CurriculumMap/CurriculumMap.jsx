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
import { curriculumMapSelector } from "../../recoil/curriculumMapSelector";
import { authTokenState } from "../../recoil/authAtom";
import { useScorecardFetching } from "../../helpers/useScorecardFetching";
import { useInitializeScoreCards } from "../../helpers/useInitializeScorecards";
import { useErrorHandler } from "../../errorHandling/useErrorHandler";
import LoadingText from "../../common/LoadingText";
import CurriculumGrid from "./CurriculumGrid";
import ProgramHeader from "./ProgramHeader";
import PlanSwitcher from "./PlanSwitcher";
import PlaceholderCreator from "./PlaceholderCreator";
import CategoryLegend from "./CategoryLegend";

const CurriculumMap = () => {
  const curriculumData = useRecoilValue(curriculumMapSelector);
  const authToken = useRecoilValue(authTokenState);
  const scorecardFetching = useScorecardFetching();
  const handleError = useErrorHandler();
  const [fetchAttempted, setFetchAttempted] = useState(false);
  // Click-to-place is disabled; placementMode stays null. Grid still receives
  // it so re-enabling later only requires restoring the useState + handlers.
  const placementMode = null;

  // Initialize scorecard data
  useInitializeScoreCards(handleError);

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
  if (!curriculumData.isLoaded) {
    return (
      <div className="flex flex-col h-full px-6 py-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Curriculum Map</h1>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-64 mx-auto mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-48 mx-auto mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-56 mx-auto"></div>
            </div>
            <LoadingText>Loading curriculum data...</LoadingText>
          </div>
        </div>
      </div>
    );
  }

  // No program data
  if (!curriculumData.program) {
    return (
      <div className="flex flex-col h-full px-6 py-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Curriculum Map</h1>
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
      {/* Header with program info and progress */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
        <ProgramHeader program={curriculumData.program} />
        <PlanSwitcher />
        <PlaceholderCreator />
      </div>

      {/* Main content area: grid (courses are dragged from EventListContainer) */}
      <div className="flex-1 overflow-auto scrollbar-thin-visible px-6 py-4">
        <CurriculumGrid
          categories={curriculumData.flatCategories}
          categoryHierarchy={curriculumData.categoryHierarchy}
          semesters={curriculumData.semesters}
          coursesBySemesterAndCategory={curriculumData.coursesBySemesterAndCategory}
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
