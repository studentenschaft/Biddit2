import { atom } from "recoil";

// Atom to store the latest valid term projection
export const latestValidTermProjectionState = atom({
  key: "latestValidTermProjectionState",
  default: null,
});
