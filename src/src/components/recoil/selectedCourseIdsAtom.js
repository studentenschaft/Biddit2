// selectedSemesterAtom.js
import { atom } from "recoil";

export const selectedCourseIdsAtom = atom({
  key: 'selectedCourseIdsState',
  default: [] // initialize as empty array to fix error when null :)
});