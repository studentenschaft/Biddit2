import { useRecoilValue } from "recoil";
import { useState } from "react";
import Select from "react-select";
import { useTermSelection } from "../../helpers/useTermSelection";
import { SelectClassification } from "./SelectClassification";
import { SelectEcts } from "./SelectEcts";
import { SelectLanguage } from "./SelectLanguage";
import { SelectLecturer } from "./SelectLecturer";
import { SelectRatings } from "./SelectRatings";
import { SearchTerm } from "./SearchTerm";
import { EventListContainer } from "../bottomRow/EventListContainer";
import ErrorBoundary from "../../../components/errorHandling/ErrorBoundary";
import { isFutureSemesterSelected } from "../../recoil/isFutureSemesterSelected";

export default function SelectSemester() {
  // Get all term selection logic from our custom hook
  const {
    isLoading,
    selectedSem,
    latestValidTerm,
    sortedTermShortNames,
    handleTermSelect,
    termIdList,
  } = useTermSelection();

  const isFutureSemester = useRecoilValue(isFutureSemesterSelected);

  // UI state
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev);
  };

  // Determine the selected semester ID for the event list container
  const selectedSemId = (() => {
    if (!selectedSem || selectedSem === "loading semester data...") return null;

    const matchingTerms =
      termIdList?.filter((term) => term.shortName === selectedSem) || [];

    if (matchingTerms.length > 1) {
      if (selectedSem === latestValidTerm) {
        const validTerm = matchingTerms.find((term) => term.isCurrent);
        if (validTerm) return validTerm;
      }
    }

    return matchingTerms[0] || null;
  })();

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
        value={{ value: selectedSem, label: selectedSem }}
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
        <EventListContainer selectedSemesterState={selectedSemId} />
      </ErrorBoundary>
    </>
  );
}

export { SelectSemester };
