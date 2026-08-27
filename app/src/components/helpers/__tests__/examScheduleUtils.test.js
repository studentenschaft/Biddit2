import { describe, expect, it } from "vitest";
import { examsForCourse } from "../examScheduleUtils";

const written = (id, rootNumbers, termType = "OT") => ({
  id,
  rootNumbers,
  termType,
});

const PLAN = {
  written: [
    written("at-lang", ["3,802", "4,802"], "AT"),
    written("ot-lang", ["3,802", "4,802"]),
    written("ot-micro", ["3,200"]),
  ],
  oral: [{ id: "oral-privacy", rootNumbers: ["7,421"] }],
};

describe("examsForCourse", () => {
  it("joins a course number to the plan's two-segment root", () => {
    const result = examsForCourse(PLAN, { courseNumber: "3,200,1.00" });

    expect(result.written.map((e) => e.id)).toEqual(["ot-micro"]);
    expect(result.oral).toEqual([]);
  });

  it("gives an exercise group its parent lecture's exam", () => {
    const result = examsForCourse(PLAN, { courseNumber: "3,200,2.04" });

    expect(result.written.map((e) => e.id)).toEqual(["ot-micro"]);
  });

  it("reads the course number out of the nested courses array", () => {
    const result = examsForCourse(PLAN, {
      courses: [{ courseNumber: "3,200,1.00" }],
    });

    expect(result.written.map((e) => e.id)).toEqual(["ot-micro"]);
  });

  it("matches a cross-listed exam on either of its roots", () => {
    const bachelor = examsForCourse(PLAN, { courseNumber: "3,802,1.00" });
    const master = examsForCourse(PLAN, { courseNumber: "4,802,1.00" });

    expect(bachelor.written.map((e) => e.id)).toEqual(master.written.map((e) => e.id));
    expect(master.written).toHaveLength(2);
  });

  it("sorts the ordinary date before the alternative one", () => {
    const result = examsForCourse(PLAN, { courseNumber: "3,802,1.00" });

    expect(result.written.map((e) => e.id)).toEqual(["ot-lang", "at-lang"]);
  });

  it("finds oral exams", () => {
    const result = examsForCourse(PLAN, { courseNumber: "7,421,1.00" });

    expect(result.oral.map((e) => e.id)).toEqual(["oral-privacy"]);
    expect(result.written).toEqual([]);
  });

  it("returns empty lists for a missing plan, a missing course or an unmatched root", () => {
    expect(examsForCourse(null, { courseNumber: "3,200,1.00" })).toEqual({
      written: [],
      oral: [],
    });
    expect(examsForCourse(PLAN, null)).toEqual({ written: [], oral: [] });
    expect(examsForCourse(PLAN, { courseNumber: "9,999,1.00" })).toEqual({
      written: [],
      oral: [],
    });
  });

  it("tolerates a plan without written or oral arrays", () => {
    expect(examsForCourse({}, { courseNumber: "3,200,1.00" })).toEqual({
      written: [],
      oral: [],
    });
  });
});
