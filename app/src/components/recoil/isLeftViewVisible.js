import { atom } from "recoil";

// Atom to store the visibility of the left view in mobile view

export const isLeftViewVisible = atom({
  key: "isLeftViewVisible",
  default: false,
});
