import { atom } from "recoil";

/**
 * @deprecated This file is unused. Semester selection is now managed by
 * unifiedCourseDataAtom.selectedSemester. Safe to delete after verification.
 * Last checked: December 2024
 */

// Atom to store the index of the selected semester
export const selectedSemesterIndexAtom = atom({
  key: "selectedSemesterIndexAtom",
  default: 0,
});

// Atom to store the selected semester
export const selectedSemesterAtom = atom({
  key: "selectedSemesterAtom",
  default: null,
});
