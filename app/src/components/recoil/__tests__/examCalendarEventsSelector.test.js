/**
 * examCalendarEventsSelector turns the ingested plan into calendar blocks.
 *
 * What matters here and is not covered by the collision tests: only ordinary
 * written exams become blocks (orals have no time, alternative dates are
 * provisional — ADR 0009), one exam is one block however many of the user's
 * courses sit it, and the collision map's red plus `conflictsWith` is threaded
 * through rather than recomputed.
 */

import { describe, expect, it } from "vitest";
import { snapshot_UNSTABLE } from "recoil";

import { examSchedulesState } from "../examScheduleAtom";
import {
  EXAM_COLLISION_COLOR,
  EXAM_COLOR,
  examCalendarEventsSelector,
} from "../examScheduleSelectors";
import { unifiedCourseDataState } from "../unifiedCourseDataAtom";

const SEMESTER = "HS26";

const PLAN = {
  schemaVersion: 1,
  written: [
    {
      id: "ot-micro",
      date: "2027-01-18",
      slot: "09:15",
      startIso: "2027-01-18T09:15:00+01:00",
      durationMin: 90,
      termType: "OT",
      rootNumbers: ["3,200"],
      title: "Mikroökonomik II",
    },
    {
      // Same date and slot as 3,200: the collision fixture.
      id: "ot-causal",
      date: "2027-01-18",
      slot: "09:15",
      startIso: "2027-01-18T09:15:00+01:00",
      durationMin: 120,
      termType: "OT",
      rootNumbers: ["7,850"],
      title: "Causal Inference",
    },
    {
      id: "ot-ops",
      date: "2027-02-05",
      slot: "09:15",
      startIso: "2027-02-05T09:15:00+01:00",
      durationMin: 90,
      termType: "OT",
      rootNumbers: ["3,140"],
      title: "Operations Management (BYOD)",
      byod: true,
    },
    {
      id: "at-ops",
      date: "2027-02-12",
      slot: "09:15",
      startIso: "2027-02-12T09:15:00+01:00",
      durationMin: 90,
      termType: "AT",
      rootNumbers: ["3,140"],
      title: "Operations Management (BYOD)",
    },
  ],
  oral: [
    {
      id: "oral-privacy",
      date: "2027-01-30",
      startIso: null,
      rootNumbers: ["7,421"],
      title: "Datenschutzrecht",
    },
  ],
};

const course = (courseNumber, shortName) => ({
  id: courseNumber,
  courseNumber,
  shortName,
});

const MICRO = course("3,200,1.00", "Microeconomics II");
const MICRO_EXERCISE = course("3,200,2.04", "Microeconomics II Exercises");
const CAUSAL = course("7,850,1.00", "Causal Inference");
const OPS = course("3,140,1.00", "Operations Management");
const PRIVACY = course("7,421,1.00", "Data Protection Law");

const eventsIn = ({
  available = [MICRO, MICRO_EXERCISE, CAUSAL, OPS, PRIVACY],
  enrolledIds = [],
  selectedIds = [],
  filtered = [],
  plan = PLAN,
  semester = SEMESTER,
  metadata = {},
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
          ...metadata,
        },
      },
      selectedSemester: SEMESTER,
      latestValidTerm: SEMESTER,
      selectedCourseInfo: null,
    });
    if (plan) set(examSchedulesState, { [SEMESTER]: { plan } });
  })
    .getLoadable(examCalendarEventsSelector(semester))
    .getValue();

describe("examCalendarEventsSelector", () => {
  it("builds a block from the exam's start and duration", () => {
    const [event] = eventsIn({ enrolledIds: [OPS.courseNumber] });

    expect(event).toMatchObject({
      id: "ot-ops",
      title: "Operations Management",
      start: "2027-02-05T09:15:00+01:00",
      entryType: "exam",
      durationMin: 90,
      byod: true,
      conflictsWith: [],
      color: EXAM_COLOR,
    });
    // 09:15 + 90' = 10:45 Zurich time, in the artifact's own offset format.
    expect(event.end).toBe("2027-02-05T10:45:00+01:00");
  });

  it("draws one block for a lecture and its exercise group", () => {
    const events = eventsIn({
      enrolledIds: [MICRO.courseNumber, MICRO_EXERCISE.courseNumber],
    });

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("ot-micro");
  });

  it("never draws oral exams or alternative dates", () => {
    const events = eventsIn({
      enrolledIds: [OPS.courseNumber, PRIVACY.courseNumber],
    });

    expect(events.map((event) => event.id)).toEqual(["ot-ops"]);
  });

  it("colors colliding exams red and names the other course", () => {
    const events = eventsIn({
      enrolledIds: [MICRO.courseNumber],
      selectedIds: [CAUSAL.courseNumber],
    });

    expect(events).toHaveLength(2);
    events.forEach((event) => {
      expect(event.color).toBe(EXAM_COLLISION_COLOR);
    });
    expect(events.find((e) => e.id === "ot-micro").conflictsWith).toEqual([
      "Causal Inference",
    ]);
    expect(events.find((e) => e.id === "ot-causal").conflictsWith).toEqual([
      "Microeconomics II",
    ]);
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

    expect(events.map((event) => event.id)).toEqual(["ot-micro"]);
  });

  it("is empty for a semester whose plan has not been fetched", () => {
    expect(eventsIn({ enrolledIds: [MICRO.courseNumber], plan: null })).toEqual(
      [],
    );
  });

  it("draws nothing for a borrowed catalog even when the plan is already cached", () => {
    // Regression net for the fetch-vs-catalog race: a cached plan must not
    // produce blocks once the semester turns out to be borrowed.
    for (const metadata of [
      { usingReferenceData: true, referenceSemester: "HS25" },
      { isFutureSemester: true, referenceSemester: "HS25" },
    ]) {
      expect(
        eventsIn({ enrolledIds: [MICRO.courseNumber], metadata }),
      ).toEqual([]);
    }
  });

  it("skips entries the plan left without a usable time", () => {
    const events = eventsIn({
      enrolledIds: [MICRO.courseNumber],
      plan: {
        ...PLAN,
        written: [{ ...PLAN.written[0], startIso: null, durationMin: 0 }],
      },
    });

    expect(events).toEqual([]);
  });
});
