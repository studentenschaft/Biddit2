/**
 * plannedExamsSelector wires `planExams` to state.
 *
 * What its pure tests cannot show: the pool is the user's courses (enrolled ∪
 * selected), never the search panel's `filtered` view state
 * (docs/BUG-calendar-entries-filter-leak.md), and a semester without a ready
 * plan yields no exams rather than an error.
 */

import { describe, expect, it } from "vitest";
import { snapshot_UNSTABLE } from "recoil";

import { examPlanState } from "../examScheduleAtom";
import { plannedExamsSelector } from "../examScheduleSelectors";
import { unifiedCourseDataState } from "../unifiedCourseDataAtom";

const SEMESTER = "HS26";

const exam = (id, root) => ({
  id,
  rootNumbers: [root],
  termType: "OT",
  startIso: "2027-01-18T09:15:00+01:00",
  durationMin: 90,
});

const PLAN = {
  schemaVersion: 2,
  written: [
    exam("ot-micro", "3,200"),
    exam("ot-causal", "7,850"),
    exam("ot-ops", "3,140"),
  ],
  oral: [],
};

const course = (courseNumber, shortName) => ({
  id: courseNumber,
  courseNumber,
  shortName,
});

const MICRO = course("3,200,1.00", "Microeconomics II");
const CAUSAL = course("7,850,1.00", "Causal Inference");
const OPS = course("3,140,1.00", "Operations Management");

const plannedExamIds = ({
  selectedIds = [],
  filtered = [],
  planState = { status: "ready", plan: PLAN },
  metadata = {},
}) =>
  snapshot_UNSTABLE(({ set }) => {
    set(unifiedCourseDataState, {
      semesters: {
        [SEMESTER]: {
          enrolledIds: [MICRO.courseNumber],
          available: [MICRO, CAUSAL, OPS],
          selectedIds,
          filtered,
          studyPlan: [],
          ratings: {},
          cisId: "1",
          ...metadata,
        },
      },
      selectedSemester: SEMESTER,
      latestValidTerm: SEMESTER,
      selectedCourseInfo: null,
    });
    set(examPlanState(SEMESTER), planState);
  })
    .getLoadable(plannedExamsSelector(SEMESTER))
    .getValue()
    .map(({ exam }) => exam.id);

describe("plannedExamsSelector", () => {
  it("collects the exams of enrolled and wishlisted courses only", () => {
    // Operations Management is only in the catalog.
    expect(plannedExamIds({ selectedIds: [CAUSAL.courseNumber] })).toEqual([
      "ot-micro",
      "ot-causal",
    ]);
  });

  it("ignores the search filter in both directions", () => {
    // Filtered-out Causal Inference stays; filtered-in Operations stays out.
    expect(
      plannedExamIds({ selectedIds: [CAUSAL.courseNumber], filtered: [OPS] }),
    ).toEqual(["ot-micro", "ot-causal"]);
  });

  it.each([
    ["still loading", { status: "loading", plan: null }],
    ["never ingested", { status: "none", plan: null }],
    ["unreadable", { status: "error", plan: null }],
  ])("is empty for a plan that is %s", (_, planState) => {
    expect(plannedExamIds({ planState })).toEqual([]);
  });

  it("is empty for a borrowed catalog even when the plan has loaded", () => {
    // The plan can finish loading before the catalog fetch sets
    // usingReferenceData, so the atom may hold a plan for a semester that
    // turns out to be borrowed.
    for (const metadata of [
      { usingReferenceData: true, referenceSemester: "HS25" },
      { isFutureSemester: true, referenceSemester: "HS25" },
    ]) {
      expect(plannedExamIds({ metadata })).toEqual([]);
    }
  });
});
