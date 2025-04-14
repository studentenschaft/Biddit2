import { atom } from "recoil";

export const courseInfoState = atom({
  key: "courseInfoState",
  default: {
    1: [], // Semester 1 data (current semester or upcoming semester)
    2: [], // Semester 2 data (previous semester)
    3: [], // Semester 3 data (add more if needed)
  },
});
