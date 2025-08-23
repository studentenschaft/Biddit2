import { selector } from "recoil";
import {
  selectedSemesterSelector,
  semesterMetadataSelector,
} from "./unifiedCourseDataSelectors";

/**
 * Selector to check if the currently selected semester is a future semester
 * This replaces the old isFutureSemesterSelected atom by using the unified state system
 */
export const isFutureSemesterSelected = selector({
  key: "isFutureSemesterSelected",
  get: ({ get }) => {
    const selectedSemester = get(selectedSemesterSelector);

    if (!selectedSemester) {
      return false;
    }

    const semesterMetadata = get(semesterMetadataSelector(selectedSemester));
    return (
      semesterMetadata.isFutureSemester || semesterMetadata.isProjected || false
    );
  },
});

/**
 * Selector to get the reference semester for the currently selected semester
 * This provides the reference semester when a future/projected semester is selected
 */
export const referenceSemester = selector({
  key: "referenceSemester",
  get: ({ get }) => {
    const selectedSemester = get(selectedSemesterSelector);

    if (!selectedSemester) {
      return null;
    }

    const semesterMetadata = get(semesterMetadataSelector(selectedSemester));
    return semesterMetadata.referenceSemester || null;
  },
});
