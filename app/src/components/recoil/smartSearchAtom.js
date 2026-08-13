import { atom } from "recoil";

/**
 * Search mode + semantic-search results for the left-column course list.
 * "keyword" keeps the existing `selectionOptions.searchTerm` filtering;
 * "smart" replaces the displayed list with vector-DB matches.
 */
export const smartSearchState = atom({
  key: "smartSearchState",
  default: {
    mode: "keyword",
    query: "",
    resultIds: [],
    distances: [],
    isLoading: false,
    hasSearched: false,
  },
});

/**
 * Map vector-DB result ids to full course objects, best match first.
 * Ids carry a semester prefix (e.g. "HSG1<courseNumber>"); the same
 * normalization SmartSearch used strips it before matching.
 */
export function orderSmartResults({ resultIds, distances, courses }) {
  return resultIds
    .map((id, i) => ({
      course: courses.find(
        (c) => c.courseNumber === id.replace(/[A-Z]+\d+/g, "")
      ),
      distance: distances[i] ?? Infinity,
    }))
    .filter((entry) => entry.course)
    .sort((a, b) => a.distance - b.distance)
    .map((entry) => entry.course);
}
