import { atom } from "recoil";

export const selectionOptionsState = atom({
  key: "selectionOptionsState",
  default: {
    classifications: [],
    ects: [],
    lecturer: [],
    ratings: [],
    courseLanguage: [],
    searchTerm: "",
  },
});
