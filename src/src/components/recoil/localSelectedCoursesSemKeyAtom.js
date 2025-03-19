import { atom } from "recoil";

// Atom to store the selected courses for study plan
// with a corresponding semester ID link

export const localSelectedCoursesSemKeyState = atom({
  key: "localSelectedCoursesSemKeyState",
  default: {
// like: 'HS23': [], // Semester 1 data
// like: 'FS24': [], // Semester 2 data etc
  },
});
