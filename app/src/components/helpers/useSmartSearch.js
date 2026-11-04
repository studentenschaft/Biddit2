/**
 * useSmartSearch
 *
 * Semantic ("smart") course search for the left-column course list. The query
 * sequence (programme, reference semester, empty/404 → upsert → retry) lives in
 * `useVectorSearch`, shared with SimilarCourses.
 *
 * Results are written to `smartSearchState` as ids + distances; the mapping back
 * to course objects is `smartSearchResultsSelector`.
 */

import { useRecoilValue, useSetRecoilState } from "recoil";
import { useVectorSearch } from "./useVectorSearch";
import { selectedSemesterSelector } from "../recoil/unifiedCourseDataSelectors";
import { smartSearchState } from "../recoil/smartSearchAtom";

export function useSmartSearch() {
  const setSmartSearch = useSetRecoilState(smartSearchState);
  const selectedSemesterShortName = useRecoilValue(selectedSemesterSelector);
  const { runQuery } = useVectorSearch();

  /**
   * Run a semantic search for `query` against the selected semester.
   * Empty queries are ignored, matching the retired tab's behaviour.
   *
   * `semesterQueried` is stamped here rather than on the response so it names
   * the term the question was asked about, even if the user switches semesters
   * while the request is in flight.
   */
  const runSearch = async (query) => {
    const trimmedQuery = (query || "").trim();
    if (!trimmedQuery) return;

    setSmartSearch((prev) => ({
      ...prev,
      query: trimmedQuery,
      isLoading: true,
      hasSearched: true,
      semesterQueried: selectedSemesterShortName,
    }));

    const { ids, distances } = await runQuery({
      courseDescription: trimmedQuery,
    });

    setSmartSearch((prev) => ({
      ...prev,
      resultIds: ids,
      distances,
      isLoading: false,
      hasSearched: true,
    }));
  };

  return { runSearch };
}
