import { atom } from "recoil";

// Atom to store the selected courses for study plan

export const localSelectedCoursesState = atom({
  key: "localSelectedCoursesState",
  default: {
    1: [], // Semester 1 data (current semester or upcoming semester)
    2: [], // Semester 2 data (previous semester)
    3: [], // Semester 3 data (add more if needed)
  },
});
