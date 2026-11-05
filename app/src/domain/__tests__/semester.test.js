import { describe, it, expect } from "vitest";
import {
  FS_MONTHS,
  normalizeSemesterKey,
  parseSemesterKey,
  compareSemesterKeys,
  sortSemesterKeys,
  nextSemesterKey,
  previousYearSameSeason,
  currentSemesterKey,
  semesterStatus,
} from "../semester";

// Local noon keeps the calendar date stable in every timezone.
const localDate = (isoDay) => new Date(`${isoDay}T12:00:00`);

describe("currentSemesterKey", () => {
  it.each([
    ["2026-01-15", "HS25"],
    ["2026-02-01", "FS26"],
    ["2026-03-15", "FS26"],
    ["2026-06-15", "FS26"],
    ["2026-07-31", "FS26"],
    ["2026-08-01", "HS26"],
    ["2026-12-31", "HS26"],
    ["2025-09-15", "HS25"],
    ["2025-10-15", "HS25"],
  ])("currentSemesterKey(%s) is %s", (d, k) =>
    expect(currentSemesterKey(localDate(d))).toBe(k),
  );

  it("treats February to July as FS (0-based months)", () => {
    expect(FS_MONTHS).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("normalizeSemesterKey", () => {
  it.each([
    ["HS 25 - Placeholder", "HS25"],
    ["HS25 - Placeholder", "HS25"],
    ["HS 25", "HS25"],
    ["FS26", "FS26"],
    [null, ""],
    [undefined, ""],
    ["Unassigned", ""],
    ["HS2025", ""],
  ])("normalizeSemesterKey(%s) is %s", (input, expected) =>
    expect(normalizeSemesterKey(input)).toBe(expected),
  );
});

describe("parseSemesterKey", () => {
  it("parses season and year", () => {
    expect(parseSemesterKey("HS24")).toEqual({
      season: "HS",
      year: 24,
      fullYear: 2024,
    });
    expect(parseSemesterKey("FS 25")).toEqual({
      season: "FS",
      year: 25,
      fullYear: 2025,
    });
  });

  it("reads two-digit years below 50 as 2000s and the rest as 1900s", () => {
    expect(parseSemesterKey("HS49").fullYear).toBe(2049);
    expect(parseSemesterKey("HS50").fullYear).toBe(1950);
  });

  it("returns null for anything that is not a semester key", () => {
    expect(parseSemesterKey("")).toBeNull();
    expect(parseSemesterKey(null)).toBeNull();
    expect(parseSemesterKey("TBD")).toBeNull();
  });
});

describe("ordering", () => {
  it("sorts chronologically with FS before HS in a year", () => {
    expect(sortSemesterKeys(["HS26", "FS26", "HS25"])).toEqual([
      "HS25",
      "FS26",
      "HS26",
    ]);
    expect(sortSemesterKeys(["HS25", "FS24", "HS24", "FS25", "FS26"])).toEqual(
      ["FS24", "HS24", "FS25", "HS25", "FS26"],
    );
  });

  it("does not mutate the input", () => {
    const input = ["HS26", "FS26"];
    sortSemesterKeys(input);
    expect(input).toEqual(["HS26", "FS26"]);
  });

  it("compares keys", () => {
    expect(compareSemesterKeys("FS25", "HS25")).toBeLessThan(0);
    expect(compareSemesterKeys("HS24", "FS25")).toBeLessThan(0);
    expect(compareSemesterKeys("FS26", "HS25")).toBeGreaterThan(0);
    expect(compareSemesterKeys("HS 25", "HS25")).toBe(0);
  });

  it("puts unparseable keys after valid ones", () => {
    expect(sortSemesterKeys(["", "HS25", "FS25"])).toEqual(["FS25", "HS25", ""]);
  });
});

describe("neighbours", () => {
  it("steps to the next semester", () => {
    expect(nextSemesterKey("FS25")).toBe("HS25");
    expect(nextSemesterKey("HS25")).toBe("FS26");
    expect(nextSemesterKey("HS99")).toBe("FS00");
  });

  it("steps through consecutive semesters from an FS start", () => {
    const keys = ["FS26"];
    for (let i = 0; i < 3; i++) keys.push(nextSemesterKey(keys[i]));
    expect(keys).toEqual(["FS26", "HS26", "FS27", "HS27"]);
  });

  it("finds the same season one year earlier", () => {
    expect(previousYearSameSeason("FS26")).toBe("FS25");
    expect(previousYearSameSeason("HS26")).toBe("HS25");
    expect(previousYearSameSeason("HS10")).toBe("HS09");
    expect(previousYearSameSeason("junk")).toBeNull();
  });
});

describe("semesterStatus", () => {
  const june = localDate("2026-06-15");

  it("classifies relative to the calendar semester", () => {
    expect(semesterStatus("FS26", june)).toBe("current");
    expect(semesterStatus("HS25", june)).toBe("completed");
    expect(semesterStatus("HS26", june)).toBe("future");
  });

  it("classifies across the year boundary in the autumn", () => {
    const october = localDate("2025-10-15");
    expect(semesterStatus("HS25", october)).toBe("current");
    expect(semesterStatus("FS26", october)).toBe("future");
    expect(semesterStatus("FS25", october)).toBe("completed");
    expect(semesterStatus("HS24", october)).toBe("completed");
  });
});
