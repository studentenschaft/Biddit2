/**
 * examCollisionsSelector wires the pure collision finder to state.
 *
 * Two properties matter here and are not visible in the finder's own tests: the
 * pool is the user's courses (enrolled ∪ selected), never the search panel's
 * `filtered` view state (docs/BUG-calendar-entries-filter-leak.md), and the
 * selector only reads the exam atom — an unfetched semester is silently empty
 * rather than an error.
 */

import { describe, expect, it } from "vitest";
import { snapshot_UNSTABLE } from "recoil";

import { examSchedulesState } from "../examScheduleAtom";
import { examCollisionsSelector } from "../examScheduleSelectors";
import { unifiedCourseDataState } from "../unifiedCourseDataAtom";

const SEMESTER = "HS26";
const SLOT = { date: "2027-01-18", slot: "09:15", termType: "OT" };

const PLAN = {
  schemaVersion: 1,
  written: [
    { id: "ot-micro", rootNumbers: ["3,200"], ...SLOT },
    { id: "ot-causal", rootNumbers: ["7,850"], ...SLOT },
    { id: "ot-ops", rootNumbers: ["3,140"], ...SLOT, slot: "15:15" },
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

const collisionsIn = ({
  available = [MICRO, CAUSAL, OPS],
  enrolledIds = [],
  selectedIds = [],
  filtered = [],
  plan = PLAN,
  semester = SEMESTER,
}) =>
  snapshot_UNSTABLE(({ set }) => {
    set(unifiedCourseDataState, {
      semesters: {
        [SEMESTER]: {
          enrolledIds,
          available,
          selectedIds,
          filtered,
          studyPlan: [],
          ratings: {},
          cisId: "1",
        },
      },
      selectedSemester: SEMESTER,
      latestValidTerm: SEMESTER,
      selectedCourseInfo: null,
    });
    if (plan) set(examSchedulesState, { [SEMESTER]: { plan } });
  }).getLoadable(examCollisionsSelector(semester)).getValue();

describe("examCollisionsSelector", () => {
  it("warns both courses when an enrolled and a wishlisted exam share a slot", () => {
    const collisions = collisionsIn({
      enrolledIds: [MICRO.courseNumber],
      selectedIds: [CAUSAL.courseNumber],
    });

    expect(collisions.get("3,200").conflictsWith).toEqual(["Causal Inference"]);
    expect(collisions.get("7,850").conflictsWith).toEqual([
      "Microeconomics II",
    ]);
  });

  it("ignores a course the user has not planned, even in the same slot", () => {
    const collisions = collisionsIn({ enrolledIds: [MICRO.courseNumber] });

    // Causal Inference sits the same exam but is only in the catalog.
    expect(collisions.size).toBe(0);
  });

  it("keeps warning about a course a search filter has hidden", () => {
    const collisions = collisionsIn({
      enrolledIds: [MICRO.courseNumber],
      selectedIds: [CAUSAL.courseNumber],
      filtered: [OPS],
    });

    expect(collisions.size).toBe(2);
  });

  it("is empty for a semester whose plan has not been fetched", () => {
    const collisions = collisionsIn({
      enrolledIds: [MICRO.courseNumber],
      selectedIds: [CAUSAL.courseNumber],
      plan: null,
    });

    expect(collisions.size).toBe(0);
  });

  it("is empty for a missing semester", () => {
    expect(collisionsIn({ semester: null }).size).toBe(0);
    expect(collisionsIn({ semester: "FS26" }).size).toBe(0);
  });
});
