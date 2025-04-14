import { atom } from "recoil";

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
