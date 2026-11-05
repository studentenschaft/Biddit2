import { describe, expect, it } from "vitest";
// BBWL rather than BIA: the BIA mock scorecard carries no graded courses.
import scorecardBBWL from "../../testing/mockData/Scorecard_BBWL.json";
import { buildAcademicPrograms } from "../buildAcademicPrograms";

const PROGRAM = "Bachelor in Business Administration";

const build = (overrides = {}) =>
  buildAcademicPrograms({
    rawScorecards: { [PROGRAM]: scorecardBBWL },
    mainStudyLookup: { [PROGRAM]: true },
    unifiedCourseData: { semesters: {} },
    ...overrides,
  });

describe("buildAcademicPrograms", () => {
  it("builds the program map with the main program as current", () => {
    const result = build();

    expect(result.currentProgram).toBe(PROGRAM);
    const program = result.programs[result.currentProgram];
    expect(program.metadata.isMainStudy).toBe(true);
    expect(program.metadata.programType).toBe("bachelor");
    expect(program.metadata.programId).toBe(PROGRAM);
    expect(
      program.transcript.processedTranscript.completedCourses.length
    ).toBeGreaterThan(0);
    expect(program.transcript.rawScorecard).toBe(scorecardBBWL);
  });

  it("marks programmes the lookup does not flag as secondary", () => {
    const result = build({
      rawScorecards: {
        [PROGRAM]: scorecardBBWL,
        "Master in Banking": scorecardBBWL,
      },
    });

    expect(result.currentProgram).toBe(PROGRAM);
    expect(result.programs["Master in Banking"].metadata).toMatchObject({
      isMainStudy: false,
      programType: "master",
    });
  });
});
