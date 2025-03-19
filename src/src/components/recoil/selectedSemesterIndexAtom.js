import { atom } from "recoil";

// Atom to store the index of the selected semester
export const selectedSemesterIndexAtom = atom({
  key: "selectedSemesterIndexAtom",
  default: 0,
});
