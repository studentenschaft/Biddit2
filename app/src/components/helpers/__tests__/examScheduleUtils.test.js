import { describe, expect, it } from "vitest";
import {
  describeExamClashes,
  examClashes,
  examsForCourse,
  formatExamClash,
  formatExamDate,
  formatExamDateRange,
  formatExamMeta,
  formatPlanSource,
  isPlannedCourse,
  planExams,
} from "../examScheduleUtils";

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
    written("at-spring", ["2,100"], "AT"),
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

    expect(bachelor.written.map((e) => e.id)).toEqual(["ot-lang"]);
    expect(master.written.map((e) => e.id)).toEqual(["ot-lang"]);
  });

  it("drops the alternative-date rows", () => {
    // This PDF's AT rows are the previous term's alternative dates, not ours:
    // at-lang is gone from the cross-listed course above, and a root with
    // nothing but an AT row has no exam at all.
    const result = examsForCourse(PLAN, { courseNumber: "2,100,1.00" });

    expect(result).toEqual({ written: [], oral: [] });
  });

  it("finds oral exams", () => {
    const result = examsForCourse(PLAN, { courseNumber: "7,421,1.00" });

    expect(result.oral.map((e) => e.id)).toEqual(["oral-privacy"]);
    expect(result.written).toEqual([]);
  });

  it("returns empty lists for a missing course or an unmatched root", () => {
    expect(examsForCourse(PLAN, null)).toEqual({ written: [], oral: [] });
    expect(examsForCourse(PLAN, { courseNumber: "9,999,1.00" })).toEqual({
      written: [],
      oral: [],
    });
  });
});

// Every exam below sits on 18.01.2027; only the start time and duration vary.
const exam = (id, rootNumbers, time, durationMin, termType = "OT") => ({
  id,
  rootNumbers,
  termType,
  startIso: `2027-01-18T${time}:00+01:00`,
  durationMin,
});

const course = (courseNumber, shortName) => ({ courseNumber, shortName });

const ALPHA = course("3,100,1.00", "Alpha");
const ALPHA_EXERCISE = course("3,100,2.04", "Alpha Exercises");
const BRAVO = course("3,200,1.00", "Bravo");
const CHARLIE = course("3,300,1.00", "Charlie");
const GERMAN_BA = course("3,802,1.00", "German C1");
const GERMAN_MA = course("4,802,1.00", "German C1");

describe("isPlannedCourse", () => {
  it("counts a course whose root is among my courses", () => {
    expect(isPlannedCourse([ALPHA, GERMAN_BA], ALPHA)).toBe(true);
    expect(isPlannedCourse([ALPHA, GERMAN_BA], ALPHA_EXERCISE)).toBe(true);
    expect(isPlannedCourse([ALPHA, GERMAN_BA], BRAVO)).toBe(false);
  });

  it("never matches two courses on a missing root", () => {
    expect(
      isPlannedCourse([course("TBA", "Unnumbered")], course("n/a", "Other")),
    ).toBe(false);
  });

  it("counts the second listing of a cross-listed exam I planned twice", () => {
    // planExams names the shared exam after German C1 (BA) alone.
    expect(isPlannedCourse([GERMAN_BA, GERMAN_MA], GERMAN_MA)).toBe(true);
  });
});

describe("planExams", () => {
  const plan = {
    written: [
      exam("a", ["3,100"], "09:15", 90),
      exam("lang", ["3,802", "4,802"], "09:15", 120),
      exam("a-at", ["3,100"], "15:15", 90, "AT"),
    ],
    oral: [{ id: "oral", rootNumbers: ["3,100"] }],
  };

  it("lists each exam once, in plan order, named by its first course", () => {
    expect(
      planExams(plan, [GERMAN_MA, ALPHA, ALPHA_EXERCISE, GERMAN_BA]),
    ).toEqual([
      { exam: plan.written[0], rootKey: "3,100", name: "Alpha" },
      { exam: plan.written[1], rootKey: "4,802", name: "German C1" },
    ]);
  });

  it("falls back to the root for a course without a shortName", () => {
    expect(planExams(plan, [{ courseNumber: "3,100,1.00" }])).toEqual([
      { exam: plan.written[0], rootKey: "3,100", name: "3,100" },
    ]);
  });

  it("is empty for courses outside the plan", () => {
    expect(planExams(plan, [])).toEqual([]);
    expect(planExams(plan, [course("9,999,1.00", "Unlisted")])).toEqual([]);
  });
});

describe("examClashes", () => {
  it.each([
    {
      name: "the same start with different durations clashes",
      written: [
        exam("a", ["3,100"], "09:15", 90),
        exam("b", ["3,200"], "09:15", 120),
      ],
      planned: [ALPHA, BRAVO],
      course: ALPHA,
      clashes: [["a", ["Bravo"]]],
    },
    {
      name: "a partial overlap from a later start clashes",
      written: [
        exam("a", ["3,100"], "09:15", 120),
        exam("b", ["3,200"], "10:30", 90),
      ],
      planned: [ALPHA, BRAVO],
      course: BRAVO,
      clashes: [["b", ["Alpha"]]],
    },
    {
      name: "an exam starting as the other ends does not clash",
      written: [
        exam("a", ["3,100"], "09:15", 90),
        exam("b", ["3,200"], "10:45", 90),
      ],
      planned: [ALPHA, BRAVO],
      course: ALPHA,
      clashes: [],
    },
    {
      name: "an exam ending as the other starts does not clash",
      written: [
        exam("a", ["3,100"], "09:15", 90),
        exam("b", ["3,200"], "10:45", 90),
      ],
      planned: [ALPHA, BRAVO],
      course: BRAVO,
      clashes: [],
    },
    {
      name: "a lecture and its exercise group share one exam",
      written: [
        exam("a", ["3,100"], "09:15", 90),
      ],
      planned: [ALPHA, ALPHA_EXERCISE],
      course: ALPHA_EXERCISE,
      clashes: [],
    },
    {
      name: "a cross-listed exam sat by two of my roots is one exam",
      written: [
        exam("lang", ["3,802", "4,802"], "09:15", 120),
        exam("b", ["3,200"], "09:15", 90),
      ],
      planned: [GERMAN_BA, GERMAN_MA, BRAVO],
      course: GERMAN_MA,
      clashes: [["lang", ["Bravo"]]],
    },
    {
      name: "a course's own exams never clash with each other",
      written: [
        exam("a1", ["3,100"], "09:15", 90),
        exam("a2", ["3,100"], "10:00", 90),
      ],
      planned: [ALPHA],
      course: ALPHA,
      clashes: [],
    },
    {
      name: "each exam of a course reports its own clash",
      written: [
        exam("a1", ["3,100"], "09:15", 90),
        exam("b", ["3,200"], "09:15", 90),
        exam("a2", ["3,100"], "15:15", 90),
        exam("c", ["3,300"], "16:00", 60),
      ],
      planned: [ALPHA, BRAVO, CHARLIE],
      course: ALPHA,
      clashes: [
        ["a1", ["Bravo"]],
        ["a2", ["Charlie"]],
      ],
    },
    {
      name: "a browsed course clashes with a planned one",
      written: [
        exam("a", ["3,100"], "09:15", 90),
        exam("b", ["3,200"], "09:15", 90),
      ],
      planned: [BRAVO],
      course: ALPHA,
      clashes: [["a", ["Bravo"]]],
    },
    {
      name: "alternative-date rows are ignored on both sides",
      written: [
        exam("a", ["3,100"], "09:15", 90),
        exam("b-at", ["3,200"], "09:15", 90, "AT"),
        exam("a-at", ["3,100"], "15:15", 90, "AT"),
        exam("c", ["3,300"], "15:15", 90),
      ],
      planned: [BRAVO, CHARLIE],
      course: ALPHA,
      clashes: [],
    },
    {
      name: "two clashing courses of the same name are named once",
      written: [
        exam("a", ["3,100"], "09:15", 90),
        exam("de-ba", ["3,802"], "09:15", 120),
        exam("de-ma", ["4,802"], "09:15", 120),
        exam("b", ["3,200"], "09:15", 90),
      ],
      planned: [GERMAN_BA, GERMAN_MA, BRAVO],
      course: ALPHA,
      clashes: [["a", ["German C1", "Bravo"]]],
    },
  ])("$name", ({ written: exams, planned, course: target, clashes }) => {
    const plan = { written: exams, oral: [] };

    expect([...examClashes(planExams(plan, planned), plan, target)]).toEqual(
      clashes,
    );
  });

  it("finds nothing for a course outside the plan", () => {
    const plan = { written: [exam("a", ["3,100"], "09:15", 90)], oral: [] };

    expect(
      examClashes(planExams(plan, [ALPHA]), plan, course("9,999,1.00", "X"))
        .size,
    ).toBe(0);
  });
});

describe("formatExamDate", () => {
  it("prints the weekday and the Swiss date", () => {
    expect(formatExamDate("2027-01-18")).toBe("Mon 18.01.2027");
    expect(formatExamDate("2027-02-06")).toBe("Sat 06.02.2027");
  });
});

describe("formatExamDateRange", () => {
  it("prints the year once, at the end", () => {
    expect(formatExamDateRange("2027-01-30", "2027-02-06")).toBe(
      "Sat 30.01. – Sat 06.02.2027",
    );
  });

  it("prints a one-day range as a plain date", () => {
    expect(formatExamDateRange("2027-01-30", "2027-01-30")).toBe(
      "Sat 30.01.2027",
    );
  });
});

describe("formatExamMeta", () => {
  it("names the duration and a digital exam", () => {
    expect(formatExamMeta({ durationMin: 120, byod: true })).toBe(
      "Exam · 120 min · digital (BYOD)",
    );
  });

  it("never says an exam is not digital", () => {
    expect(formatExamMeta({ durationMin: 90 })).toBe("Exam · 90 min");
    expect(formatExamMeta({ durationMin: 90, byod: false })).toBe(
      "Exam · 90 min",
    );
  });
});

describe("formatExamClash", () => {
  it("states a planned course's clash", () => {
    expect(formatExamClash(["Alpha", "Bravo"], true)).toBe(
      "Exam clash with: Alpha, Bravo",
    );
  });

  it("puts a browsed course's clash in the conditional", () => {
    expect(formatExamClash(["Alpha", "Bravo"], false)).toBe(
      "Exam would clash with: Alpha, Bravo",
    );
  });
});

describe("describeExamClashes", () => {
  it("names each clashing course once, in order, however many exams clash", () => {
    const clashes = new Map([
      ["ot-a", ["Bravo", "Charlie"]],
      ["ot-b", ["Charlie", "Delta"]],
    ]);

    expect(describeExamClashes(clashes, true)).toEqual({
      names: ["Bravo", "Charlie", "Delta"],
      label:
        "Exam clash with: Bravo, Charlie, Delta. Indicative — verify officially.",
    });
  });

  it("says nothing when nothing clashes", () => {
    expect(describeExamClashes(new Map(), true)).toBeNull();
  });
});

describe("formatPlanSource", () => {
  it("names the plan and the day it was published", () => {
    expect(
      formatPlanSource({
        sourceTermLabel: "Winter 2027",
        source: { publishedAt: "2026-08-18" },
      }),
    ).toBe("Winter 2027 plan, published 18.08.2026");
  });
});
