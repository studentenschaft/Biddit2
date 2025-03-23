import { atom } from "recoil";

export const isFutureSemesterSelected = atom({
  key: "isFutureSemesterSelected",
  default: false,
});

export const referenceSemester = atom({
  key: "referenceSemester",
  default: null,
});
