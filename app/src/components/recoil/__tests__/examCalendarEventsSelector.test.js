/**
 * examCalendarEventsSelector turns the ingested plan into calendar blocks:
 * what a block carries, and that each block takes its red and its names from
 * its own exam's clashes. Which exams are the user's is planExams' job
 * (examScheduleUtils.test, plannedExamsSelector.test).
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

// 3,200 and 7,850 share one slot.
const PLAN = mockData.examSchedule;

const course = (courseNumber, shortName) => ({
  id: courseNumber,
  courseNumber,
  shortName,
});

const MICRO = course("3,200,1.00", "Microeconomics II");
const CAUSAL = course("7,850,1.00", "Causal Inference");
const OPS = course("3,140,1.00", "Operations Management");

const eventsIn = ({ enrolledIds = [], selectedIds = [], plan = PLAN }) =>
  snapshot_UNSTABLE(({ set }) => {
    set(unifiedCourseDataState, {
      semesters: {
        [SEMESTER]: {
          enrolledIds,
          available: [MICRO, CAUSAL, OPS],
          selectedIds,
          filtered: [],
          studyPlan: [],
          ratings: {},
          cisId: "1",
        },
      },
      selectedSemester: SEMESTER,
      latestValidTerm: SEMESTER,
      selectedCourseInfo: null,
    });
    set(examPlanState(SEMESTER), { status: "ready", plan });
  })
    .getLoadable(examCalendarEventsSelector(SEMESTER))
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
});
