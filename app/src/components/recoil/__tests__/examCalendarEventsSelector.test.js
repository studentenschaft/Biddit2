/**
 * examCalendarEventsSelector turns the ingested plan into calendar blocks.
 *
 * What matters here and is not covered by the clash tests: only ordinary
 * written exams become blocks (orals have no time, and this PDF's AT rows are
 * another term's alternative dates), one exam is one block however many of the
 * user's courses sit it, and each block takes its red and its names from its
 * own exam's clashes.
 */

import { describe, expect, it } from "vitest";
import { snapshot_UNSTABLE } from "recoil";

import { mockData } from "../../../test/mocks/handlers";
import { examPlanState } from "../examScheduleAtom";
import {
  EXAM_COLLISION_COLOR,
  examCalendarEventsSelector,
} from "../examScheduleSelectors";
import { unifiedCourseDataState } from "../unifiedCourseDataAtom";

const SEMESTER = "HS26";

// Covers OT and AT rows, an oral exam, and 3,200 and 7,850 in one slot.
const PLAN = mockData.examSchedule;

const course = (courseNumber, shortName) => ({
  id: courseNumber,
  courseNumber,
  shortName,
});

const MICRO = course("3,200,1.00", "Microeconomics II");
const MICRO_EXERCISE = course("3,200,2.04", "Microeconomics II Exercises");
const CAUSAL = course("7,850,1.00", "Causal Inference");
const OPS = course("3,140,1.00", "Operations Management");
const GERMAN = course("3,802,1.00", "German C1");
const PRIVACY = course("7,421,1.00", "Data Protection Law");

const eventsIn = ({
  available = [MICRO, MICRO_EXERCISE, CAUSAL, OPS, GERMAN, PRIVACY],
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
    if (semester) {
      set(
        examPlanState(semester),
        plan ? { status: "ready", plan } : { status: "loading", plan: null },
      );
    }
  })
    .getLoadable(examCalendarEventsSelector(semester))
    .getValue();

describe("examCalendarEventsSelector", () => {
  it("builds a block from the exam's start and duration", () => {
    const [event] = eventsIn({ enrolledIds: [OPS.courseNumber] });

    expect(event).toMatchObject({
      id: "OT-2027-02-05-0915-3,140",
      title: "Operations Management",
      // Zurich wall-clock time without an offset, like the lectures.
      start: "2027-02-05T09:15:00",
      end: "2027-02-05T10:45:00",
      entryType: "exam",
      conflictsWith: [],
    });
  });

  it("draws one block for a lecture and its exercise group", () => {
    const events = eventsIn({
      enrolledIds: [MICRO.courseNumber, MICRO_EXERCISE.courseNumber],
    });

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("OT-2027-01-18-0915-3,200");
  });

  it("never draws oral exams or alternative dates", () => {
    const events = eventsIn({
      enrolledIds: [GERMAN.courseNumber, PRIVACY.courseNumber],
    });

    expect(events.map((event) => event.id)).toEqual([
      "OT-2027-01-26-0915-3,802|4,802",
    ]);
  });

  it("colors colliding exams red and names the other course", () => {
    const events = eventsIn({
      enrolledIds: [MICRO.courseNumber],
      selectedIds: [CAUSAL.courseNumber],
    });

    expect(events).toHaveLength(2);
    events.forEach((event) => {
      expect(event).toMatchObject({
        backgroundColor: "#FFFFFF",
        borderColor: EXAM_COLLISION_COLOR,
        textColor: EXAM_COLLISION_COLOR,
      });
    });
    expect(
      Object.fromEntries(events.map((event) => [event.id, event.conflictsWith])),
    ).toEqual({
      "OT-2027-01-18-0915-3,200": ["Causal Inference"],
      "OT-2027-01-18-0915-7,850": ["Microeconomics II"],
    });
  });

  it("colours each exam of a course by its own clash", () => {
    // Causal Inference gets a second exam, in Operations Management's slot.
    const plan = {
      ...PLAN,
      written: [
        ...PLAN.written,
        {
          ...PLAN.written[2],
          id: "OT-2027-02-05-0915-7,850",
          rootNumbers: ["7,850"],
        },
      ],
    };
    const events = eventsIn({
      plan,
      enrolledIds: [MICRO.courseNumber, CAUSAL.courseNumber, OPS.courseNumber],
    });

    expect(
      Object.fromEntries(events.map((event) => [event.id, event.conflictsWith])),
    ).toEqual({
      "OT-2027-01-18-0915-3,200": ["Causal Inference"],
      "OT-2027-01-18-0915-7,850": ["Microeconomics II"],
      "OT-2027-02-05-0915-7,850": ["Operations Management"],
      "OT-2027-02-05-0915-3,140": ["Causal Inference"],
    });
    events.forEach((event) => {
      expect(event.borderColor).toBe(EXAM_COLLISION_COLOR);
    });
  });

  it("ignores courses the user has not planned", () => {
    // Every course above is in the catalog; none is enrolled or wishlisted.
    expect(eventsIn({})).toEqual([]);
  });

  it("keeps the block of a course a search filter has hidden", () => {
    const events = eventsIn({
      enrolledIds: [MICRO.courseNumber],
      filtered: [OPS],
    });

    expect(events.map((event) => event.id)).toEqual([
      "OT-2027-01-18-0915-3,200",
    ]);
  });

  it("is empty while the plan is still loading", () => {
    expect(eventsIn({ enrolledIds: [MICRO.courseNumber], plan: null })).toEqual(
      [],
    );
  });
});
