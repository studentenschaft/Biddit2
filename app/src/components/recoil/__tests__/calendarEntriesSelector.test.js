/**
 * Regression tests for calendarEntriesSelector.
 *
 * The personal schedule (calendar, heatmap, conflict warnings) must be derived
 * from the user's enrolments and wishlist — never from the search panel's
 * `filtered` view state. See docs/BUG-calendar-entries-filter-leak.md.
 */

import { describe, expect, it } from "vitest";
import { snapshot_UNSTABLE } from "recoil";

import { unifiedCourseDataState } from "../unifiedCourseDataAtom";
import {
  calendarEntriesSelector,
  COLLISION_COLOR,
} from "../calendarEntriesSelector";

const SEMESTER = "HS26";
const ENROLLED_GREEN = "rgba(0,102,37, 1)";
const SELECTED_GRAY = "rgb(156 163 175)";

const course = ({ courseNumber, shortName, credits, eventDate, duration }) => ({
  id: courseNumber,
  courseNumber,
  shortName,
  credits,
  calendarEntry: [
    { eventDate, durationInMinutes: duration, room: "01-101" },
  ],
});

// 6 ECTS — excluded by an ECTS=4 filter.
const BIG = course({
  courseNumber: "7,214,1.00",
  shortName: "Big Data",
  credits: 6,
  eventDate: "2026-09-21T08:15:00.000Z",
  duration: 90,
});

// 6 ECTS, overlaps BIG by 45 minutes.
const OVERLAP = course({
  courseNumber: "8,180,1.00",
  shortName: "Data Science",
  credits: 6,
  eventDate: "2026-09-21T09:00:00.000Z",
  duration: 90,
});

// 4 ECTS — survives an ECTS=4 filter, no time overlap with the others.
const SMALL = course({
  courseNumber: "9,001,1.00",
  shortName: "Statistics",
  credits: 4,
  eventDate: "2026-09-22T08:15:00.000Z",
  duration: 90,
});

/** Mimics updateFilteredCourses: flags are attached after filtering. */
const withFlags = (c, { enrolledIds = [], selectedIds = [] }) => ({
  ...c,
  enrolled: enrolledIds.includes(c.courseNumber),
  selected: selectedIds.includes(c.courseNumber),
});

const readEntries = ({ available, enrolledIds, selectedIds, filtered }) => {
  const snapshot = snapshot_UNSTABLE(({ set }) =>
    set(unifiedCourseDataState, {
      semesters: {
        [SEMESTER]: {
          available,
          enrolledIds,
          selectedIds,
          filtered,
        },
      },
      selectedSemester: SEMESTER,
      latestValidTerm: SEMESTER,
      selectedCourseInfo: null,
    }),
  );
  return snapshot.getLoadable(calendarEntriesSelector).getValue();
};

describe("calendarEntriesSelector", () => {
  it("keeps an enrolled course in the calendar when a filter excludes it", () => {
    const entries = readEntries({
      available: [BIG, SMALL],
      enrolledIds: [BIG.courseNumber],
      selectedIds: [],
      // ECTS=4 filter active: the enrolled 6-ECTS course is not in the pool.
      filtered: [withFlags(SMALL, { enrolledIds: [BIG.courseNumber] })],
    });

    expect(entries.map((e) => e.title)).toEqual(["Big Data"]);
    expect(entries[0].start).toBe("2026-09-21T08:15:00.000Z");
    expect(entries[0].end).toBe("2026-09-21T09:45:00.000Z");
  });

  it("detects a conflict between two enrolled courses while a filter hides one", () => {
    const enrolledIds = [BIG.courseNumber, OVERLAP.courseNumber];
    const entries = readEntries({
      available: [BIG, OVERLAP, SMALL],
      enrolledIds,
      selectedIds: [],
      // Filter leaves only SMALL and OVERLAP visible; BIG is hidden.
      filtered: [
        withFlags(OVERLAP, { enrolledIds }),
        withFlags(SMALL, { enrolledIds }),
      ],
    });

    const big = entries.find((e) => e.title === "Big Data");
    const overlap = entries.find((e) => e.title === "Data Science");

    expect(big).toBeDefined();
    expect(overlap).toBeDefined();
    expect(big.overlapping).toBe(true);
    expect(overlap.overlapping).toBe(true);
    expect(big.color).toBe(COLLISION_COLOR);
    expect(overlap.color).toBe(COLLISION_COLOR);
    expect(big.conflictsWith).toContain("Data Science");
    expect(overlap.conflictsWith).toContain("Big Data");
  });

  it("emits a course present in both enrolled and selected exactly once", () => {
    const entries = readEntries({
      available: [BIG],
      enrolledIds: [BIG.courseNumber],
      selectedIds: [BIG.courseNumber],
      filtered: [],
    });

    expect(entries.filter((e) => e.title === "Big Data")).toHaveLength(1);
    expect(entries[0].overlapping).toBe(false);
    expect(entries[0].color).toBe(ENROLLED_GREEN);
  });

  it("colours enrolled courses green and merely selected courses gray", () => {
    const enrolledIds = [BIG.courseNumber];
    const selectedIds = [SMALL.courseNumber];
    const entries = readEntries({
      available: [BIG, SMALL],
      enrolledIds,
      selectedIds,
      // No filter distortion: everything visible, flags attached.
      filtered: [BIG, SMALL].map((c) =>
        withFlags(c, { enrolledIds, selectedIds }),
      ),
    });

    const big = entries.find((e) => e.title === "Big Data");
    const small = entries.find((e) => e.title === "Statistics");

    expect(big.color).toBe(ENROLLED_GREEN);
    expect(small.color).toBe(SELECTED_GRAY);
  });
});
