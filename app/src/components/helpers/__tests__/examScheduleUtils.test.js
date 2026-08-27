import { describe, expect, it } from "vitest";
import { examsForCourse, findExamCollisions } from "../examScheduleUtils";

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

const slotted = (id, rootNumbers, date, slot, termType = "OT") => ({
  id,
  rootNumbers,
  date,
  slot,
  termType,
});

const MORNING = "2027-01-18";
const AFTERNOON_SLOT = "15:15";
const SLOT = "09:15";

const COLLIDING_PLAN = {
  written: [
    slotted("ot-micro", ["3,200"], MORNING, SLOT),
    slotted("ot-causal", ["7,850"], MORNING, SLOT),
    slotted("ot-ops", ["3,140"], MORNING, AFTERNOON_SLOT),
    slotted("at-lang", ["3,802", "4,802"], MORNING, SLOT, "AT"),
  ],
  oral: [{ id: "oral-privacy", rootNumbers: ["7,421"], date: MORNING }],
};

const course = (courseNumber, shortName) => ({ courseNumber, shortName });

describe("findExamCollisions", () => {
  it("pairs up two courses sitting the same date and slot", () => {
    const collisions = findExamCollisions(COLLIDING_PLAN, [
      course("3,200,1.00", "Microeconomics II"),
      course("7,850,1.00", "Causal Inference"),
    ]);

    expect([...collisions.keys()].sort()).toEqual(["3,200", "7,850"]);
    expect(collisions.get("3,200").conflictsWith).toEqual(["Causal Inference"]);
    expect(collisions.get("7,850").conflictsWith).toEqual([
      "Microeconomics II",
    ]);
    expect(collisions.get("3,200").exam.id).toBe("ot-micro");
  });

  it("leaves the same day's other slot alone", () => {
    const collisions = findExamCollisions(COLLIDING_PLAN, [
      course("3,200,1.00", "Microeconomics II"),
      course("3,140,1.00", "Operations Management"),
    ]);

    expect(collisions.size).toBe(0);
  });

  it("does not collide a lecture with its own exercise group", () => {
    // Both normalise to root 3,200 — one exam, not two.
    const collisions = findExamCollisions(COLLIDING_PLAN, [
      course("3,200,1.00", "Microeconomics II"),
      course("3,200,2.04", "Microeconomics II - Exercises"),
    ]);

    expect(collisions.size).toBe(0);
  });

  it("names a colliding root once, after the first course that carries it", () => {
    const collisions = findExamCollisions(COLLIDING_PLAN, [
      course("3,200,1.00", "Microeconomics II"),
      course("3,200,2.04", "Microeconomics II - Exercises"),
      course("7,850,1.00", "Causal Inference"),
    ]);

    expect(collisions.size).toBe(2);
    expect(collisions.get("7,850").conflictsWith).toEqual([
      "Microeconomics II",
    ]);
  });

  it("collides a cross-listed exam with a third course", () => {
    const plan = {
      written: [
        ...COLLIDING_PLAN.written,
        slotted("ot-lang", ["3,802", "4,802"], MORNING, SLOT),
      ],
    };

    const collisions = findExamCollisions(plan, [
      course("4,802,1.00", "German C1"),
      course("3,200,1.00", "Microeconomics II"),
    ]);

    expect(collisions.get("4,802").conflictsWith).toEqual([
      "Microeconomics II",
    ]);
    expect(collisions.get("3,200").conflictsWith).toEqual(["German C1"]);
  });

  it("ignores alternative dates and oral exams", () => {
    // 3,802's only entry in this plan is the AT row, which shares the slot with
    // 3,200 — provisional, and only for students granted the alternative date.
    const collisions = findExamCollisions(COLLIDING_PLAN, [
      course("3,200,1.00", "Microeconomics II"),
      course("3,802,1.00", "German C1"),
      course("7,421,1.00", "Data Protection Law"),
    ]);

    expect(collisions.size).toBe(0);
  });

  it("falls back to the root when a course has no shortName", () => {
    const collisions = findExamCollisions(COLLIDING_PLAN, [
      course("3,200,1.00", "Microeconomics II"),
      { courseNumber: "7,850,1.00" },
    ]);

    expect(collisions.get("3,200").conflictsWith).toEqual(["7,850"]);
  });

  it("returns an empty map for missing inputs and courses outside the plan", () => {
    expect(findExamCollisions(null, [course("3,200,1.00", "M")]).size).toBe(0);
    expect(findExamCollisions({}, [course("3,200,1.00", "M")]).size).toBe(0);
    expect(findExamCollisions(COLLIDING_PLAN, null).size).toBe(0);
    expect(findExamCollisions(COLLIDING_PLAN, []).size).toBe(0);
    expect(
      findExamCollisions(COLLIDING_PLAN, [
        course("9,999,1.00", "Unlisted"),
        course("9,998,1.00", "Also unlisted"),
      ]).size
    ).toBe(0);
  });

  it("ignores plan entries without a date or a slot", () => {
    const plan = {
      written: [
        { id: "broken-a", rootNumbers: ["3,200"], termType: "OT" },
        { id: "broken-b", rootNumbers: ["7,850"], termType: "OT" },
      ],
    };

    expect(
      findExamCollisions(plan, [
        course("3,200,1.00", "Microeconomics II"),
        course("7,850,1.00", "Causal Inference"),
      ]).size
    ).toBe(0);
  });
});
