import { atom } from "recoil";

/**
 * Atom to store the latest valid term for projection purposes
 * This is used for projected future semesters
 */
export const latestValidTermProjectionState = atom({
  key: "latestValidTermProjectionState",
  default: null,
});
