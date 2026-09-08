// The regression this pins: courses saved during a Bachelor (HS22, FS23) were
// rendered inside the Master's scorecard categories, wearing the names and
// credits of whatever today's catalogue happens to hold under the same id.

import { describe, expect, it } from "vitest";
import {
  deriveMainProgramEraStart,
  deriveProgramStartSemester,
  isSemesterInProgramEra,
} from "../programEraScope";

/** Minimal stand-in for a program entry of `unifiedAcademicDataState.programs`. */
const program = (semesters, extra = {}) => ({
  transcript: {
    rawScorecard: {
      items: [
        {
          isTitle: true,
          hierarchy: "1",
          items: semesters.map((semester, index) => ({
            isDetail: true,
            id: `course-${index}`,
            semester,
          })),
        },
      ],
    },
  },
  ...extra,
});

describe("deriveProgramStartSemester", () => {
  it("uses the earliest dated item of the main program", () => {
    expect(
      deriveProgramStartSemester(program(["HS 26", "FS 26", "HS 25"]), [])
    ).toBe("HS25");
  });

  it("normalises the scorecard's spaced semester names", () => {
    expect(deriveProgramStartSemester(program(["FS 27"]), [])).toBe("FS27");
  });

  it("ignores items that carry no usable semester", () => {
    expect(
      deriveProgramStartSemester(
        program([undefined, "", "Unassigned", "HS25"]),
        []
      )
    ).toBe("HS25");
  });

  it("orders FS before HS inside the same year", () => {
    expect(deriveProgramStartSemester(program(["HS26", "FS26"]), [])).toBe(
      "FS26"
    );
  });

  it("falls back to the semester after the latest dated item of another program", () => {
    // A fresh Master student: no dated Master items yet, Bachelor ended FS26.
    expect(
      deriveProgramStartSemester(program([]), [program(["HS22", "FS26"])])
    ).toBe("HS26");
  });

  it("rolls the fallback into the next calendar year after an autumn term", () => {
    expect(deriveProgramStartSemester(program([]), [program(["HS26"])])).toBe(
      "FS27"
    );
  });

  it("returns null when nothing is dated, so nothing gets scoped away", () => {
    expect(deriveProgramStartSemester(program([]), [program([])])).toBeNull();
  });

  it("returns null without a main program", () => {
    expect(deriveProgramStartSemester(null, [program(["HS25"])])).toBeNull();
  });

  it("reads a program that exposes its scorecard items directly", () => {
    expect(
      deriveProgramStartSemester({ items: [{ isDetail: true, semester: "HS24" }] }, [])
    ).toBe("HS24");
  });
});

describe("isSemesterInProgramEra", () => {
  it("keeps everything when no start semester is known", () => {
    expect(isSemesterInProgramEra("HS22", null)).toBe(true);
    expect(isSemesterInProgramEra("HS22", undefined)).toBe(true);
  });

  it("keeps the start semester itself and everything after it", () => {
    expect(isSemesterInProgramEra("HS25", "HS25")).toBe(true);
    expect(isSemesterInProgramEra("FS26", "HS25")).toBe(true);
    expect(isSemesterInProgramEra("HS26", "HS25")).toBe(true);
  });

  it("excludes semesters from before the program", () => {
    expect(isSemesterInProgramEra("HS22", "HS25")).toBe(false);
    expect(isSemesterInProgramEra("FS23", "HS25")).toBe(false);
    expect(isSemesterInProgramEra("FS25", "HS25")).toBe(false);
  });

  it("normalises both sides before comparing", () => {
    expect(isSemesterInProgramEra("HS 22", "HS 25")).toBe(false);
    expect(isSemesterInProgramEra("hs26", "HS 25")).toBe(true);
  });

  it("keeps keys it cannot parse rather than hiding them", () => {
    expect(isSemesterInProgramEra("Unassigned", "HS25")).toBe(true);
    expect(isSemesterInProgramEra("", "HS25")).toBe(true);
    expect(isSemesterInProgramEra("HS22", "not-a-semester")).toBe(true);
  });
});

describe("deriveMainProgramEraStart", () => {
  const programs = {
    "Bachelor of Arts": program(["HS22", "FS26"]),
    "Master of Arts": program(["HS26"]),
  };

  it("derives the era of the named main program", () => {
    expect(deriveMainProgramEraStart(programs, "Master of Arts")).toBe("HS26");
    expect(deriveMainProgramEraStart(programs, "Bachelor of Arts")).toBe("HS22");
  });

  it("returns null for an unknown or missing main program", () => {
    expect(deriveMainProgramEraStart(programs, "Doctorate")).toBeNull();
    expect(deriveMainProgramEraStart(programs, null)).toBeNull();
    expect(deriveMainProgramEraStart(null, "Master of Arts")).toBeNull();
  });
});
