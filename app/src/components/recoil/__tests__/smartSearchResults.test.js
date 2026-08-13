import { describe, expect, it } from "vitest";
import { orderSmartResults } from "../smartSearchAtom";

// Real HSG course numbers ("7,214,1.00") with the semester token the vector DB
// appends. The normalization (`/[A-Z]+\d+/g`, kept verbatim from SmartSearch) is
// greedy, so it only recovers the course number when that token trails it —
// a leading "HSG1222"-style token would swallow the digits of the number too.
const COURSES = [
  { courseNumber: "7,214,1.00", shortName: "A" },
  { courseNumber: "8,180,1.00", shortName: "B" },
  { courseNumber: "9,001,1.00", shortName: "C" },
];

describe("orderSmartResults", () => {
  it("maps ids to courses ordered by distance and drops unknown ids", () => {
    const result = orderSmartResults({
      resultIds: ["8,180,1.00HS25", "7,214,1.00HS25", "1,999,1.00HS25"],
      distances: [0.4, 0.1, 0.2],
      courses: COURSES,
    });
    expect(result.map((c) => c.shortName)).toEqual(["A", "B"]);
  });

  it("falls back to Infinity for ids with no distance, ranking them last", () => {
    const result = orderSmartResults({
      resultIds: ["7,214,1.00HS25", "8,180,1.00HS25"],
      distances: [],
      courses: COURSES,
    });
    expect(result.map((c) => c.shortName)).toEqual(["A", "B"]);
  });

  it("returns [] when there are no results", () => {
    expect(
      orderSmartResults({ resultIds: [], distances: [], courses: COURSES })
    ).toEqual([]);
  });
});
