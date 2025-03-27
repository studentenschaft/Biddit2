// recoil/mergedScorecardBySemesterAtom.js
import { atom } from "recoil";

/**
 * Holds the final (merged) scorecard data with wishlist included.
 * Initially null, meaning no merged data yet.
 * Format: Program Name -> Semester Name -> course (see below)
  * {
      "name": "IC: From Data2Dollar - Dein Technologiekoffer von der Datenbeschaffung bis zur Visualisierung",
      "credits": 4,
      "type": "Research, Practice, Ventureprojects / Issue Coverage-wishlist",
      "big_type": "core",
      "id": "d6dc4a93-aa3f-4d10-992a-dc574d81612a",
      "calendarEntry": []
  }
 */
export const mergedScorecardBySemesterAtom = atom({
  key: "mergedScorecardBySemesterAtom",
  default: null,
});