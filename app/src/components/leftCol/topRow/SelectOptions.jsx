import { useRecoilValue } from "recoil";
import { useState } from "react";
import Select from "react-select";
import { useTermSelection } from "../../helpers/useTermSelection";
import { useUnifiedSemesterState } from "../../helpers/useUnifiedSemesterState";
import { selectedSemesterSelector } from "../../recoil/unifiedCourseDataSelectors";
import { SelectClassification } from "./SelectClassification";
import { SelectEcts } from "./SelectEcts";
import { SelectLanguage } from "./SelectLanguage";
import { SelectLecturer } from "./SelectLecturer";
import { SelectRatings } from "./SelectRatings";
import { SearchTerm } from "./SearchTerm";
import { EventListContainer } from "../bottomRow/EventListContainer";
import ErrorBoundary from "../../../components/errorHandling/ErrorBoundary";

export default function SelectSemester() {
  // SIMPLIFIED: Get termListObject from new useTermSelection hook
  const { isLoading, termListObject } = useTermSelection();

  // Get current selected semester from unified state
  const selectedSemesterShortName = useRecoilValue(selectedSemesterSelector);

  // Unified semester state hook for setting selected semester
  const { setSelectedSemester } = useUnifiedSemesterState();

  // UI state
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev);
  };

  // Handle semester selection - SIMPLIFIED
  const handleTermSelect = (selectedShortName) => {
    // Update unified state with the new selected semester
    // termListObject contains latestValidTerm info, so we can pass it
    const latestValidTerm =
      termListObject?.find((term) => term.isCurrent)?.shortName ||
      termListObject?.[0]?.shortName;
    setSelectedSemester(selectedShortName, termListObject, latestValidTerm);
  };

  // Check if selected semester is projected (future)
  const selectedSemesterData = termListObject?.find(
    (term) => term.shortName === selectedSemesterShortName
  );
  const isFutureSemester = selectedSemesterData?.isProjected || false;

  // SIMPLIFIED: Create sorted term names from termListObject
  const sortedTermShortNames =
    termListObject?.map((term) => term.shortName) || [];

  // Handle loading state with skeleton UI
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="w-full h-10 bg-gray-200 rounded animate-pulse" />
        <div className="w-full h-10 bg-gray-200 rounded animate-pulse" />
        <div className="w-full h-10 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="w-full h-10 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  // Once we have a valid term selected, render the UI
  return (
    <>
      <Select
        className="text-sm"
        name="semester"
        id="semester"
        value={{
          value: selectedSemesterShortName || "",
          label: selectedSemesterShortName || "Select Semester",
        }}
        onChange={(option) => handleTermSelect(option.value)}
        options={sortedTermShortNames.map((term) => ({
          value: term,
          label: term,
        }))}
        placeholder="Select Semester"
      />

      {isFutureSemester && (
        <h5 className="mt-4 mb-2 text-sm font-medium leading-6 text-gray-500">
          Disclaimer: The course data for your currently selected semester is
          not yet confirmed and may not be accurate. We display it as a preview
          for you to be able to plan ahead. We will update the data as soon as
          HSG releases it.
        </h5>
      )}

      <h3 className="mt-4 mb-2 text-lg font-medium leading-6 text-gray-900">
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
        {/* SIMPLIFIED: Pass termListObject and selectedSemesterShortName */}
        <EventListContainer
          termListObject={termListObject || []}
          selectedSemesterShortName={selectedSemesterShortName || ""}
        />
      </ErrorBoundary>
    </>
  );
}

export { SelectSemester };
