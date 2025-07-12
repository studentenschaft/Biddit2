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
    console.log(
      "🔍 [SEMESTER ID] Determining selected semester ID for:",
      selectedSem
    );

    if (!selectedSem || selectedSem === "loading semester data...") {
      console.log("❌ [SEMESTER ID] No valid semester selected");
      return null;
    }

    const matchingTerms =
      termIdList?.filter((term) => term.shortName === selectedSem) || [];

    console.log(
      "📋 [SEMESTER ID] Found",
      matchingTerms.length,
      "matching terms for",
      selectedSem
    );

    if (matchingTerms.length > 0) {
      // Term exists in original termIdList
      if (matchingTerms.length > 1) {
        if (selectedSem === latestValidTerm) {
          const validTerm = matchingTerms.find((term) => term.isCurrent);
          if (validTerm) {
            console.log(
              "✅ [SEMESTER ID] Using current term:",
              validTerm.shortName,
              "ID:",
              validTerm.id
            );
            return validTerm;
          }
        }
      }

      const finalTerm = matchingTerms[0];
      console.log(
        "✅ [SEMESTER ID] Using term:",
        finalTerm.shortName,
        "ID:",
        finalTerm.id
      );
      return finalTerm;
    } else {
      // This is a future semester we added - need to use reference term
      console.log(
        "🔮 [SEMESTER ID] Selected term is future semester, finding reference term"
      );

      const selectedYear = parseInt(selectedSem.slice(2));
      const selectedSeason = selectedSem.slice(0, 2);
      const referenceTermShortName = selectedSeason + (selectedYear - 1);

      console.log(
        "🎯 [SEMESTER ID] Looking for reference term:",
        referenceTermShortName
      );

      const referenceTerms =
        termIdList?.filter(
          (term) => term.shortName === referenceTermShortName
        ) || [];

      if (referenceTerms.length > 0) {
        const referenceTerm = referenceTerms[0];
        console.log(
          "✅ [SEMESTER ID] Using reference term:",
          referenceTerm.shortName,
          "ID:",
          referenceTerm.id,
          "for future semester:",
          selectedSem
        );

        // Return a modified term object that indicates it's being used for projection
        return {
          ...referenceTerm,
          shortName: selectedSem, // Keep the selected semester name for display
          isProjection: true, // Flag to indicate this is a projection
        };
      } else {
        console.log(
          "❌ [SEMESTER ID] No reference term found for future semester"
        );
        return null;
      }
    }
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
