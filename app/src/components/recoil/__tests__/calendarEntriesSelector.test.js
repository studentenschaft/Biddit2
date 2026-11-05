/**
 * Regression tests for calendarEntriesSelector.
 *
 * The personal schedule (calendar, heatmap, conflict warnings) must be derived
 * from the user's enrolments and wishlist — never from the search panel's
 * filtered view state. See docs/BUG-calendar-entries-filter-leak.md.
 */

import { describe, expect, it } from "vitest";
import { snapshot_UNSTABLE } from "recoil";

import { selectionOptionsState } from "../selectionOptionsAtom";
import { unifiedCourseDataState } from "../unifiedCourseDataAtom";
import { filteredCoursesSelector } from "../unifiedCourseDataSelectors";
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

const ECTS_4_ONLY = { ects: [4] };

const snapshotOf = ({ available, enrolledIds, selectedIds, filters = {} }) =>
  snapshot_UNSTABLE(({ set }) => {
    set(unifiedCourseDataState, {
      semesters: {
        [SEMESTER]: {
          available,
          enrolledIds,
          selectedIds,
        },
      },
      selectedSemester: SEMESTER,
      latestValidTerm: SEMESTER,
      selectedCourseInfo: null,
    });
    set(selectionOptionsState, (prev) => ({ ...prev, ...filters }));
  });

const readEntries = (state) =>
  snapshotOf(state).getLoadable(calendarEntriesSelector).getValue();

describe("calendarEntriesSelector", () => {
  it("keeps an enrolled course in the calendar when a filter excludes it", () => {
    const entries = readEntries({
      available: [BIG, SMALL],
      enrolledIds: [BIG.courseNumber],
      selectedIds: [],
      // ECTS=4 filter active: the enrolled 6-ECTS course is not in the pool.
      filters: ECTS_4_ONLY,
    });

    expect(entries.map((e) => e.title)).toEqual(["Big Data"]);
  });

  it("hands the calendar St. Gallen time, whatever the reader's zone", () => {
    const [entry] = readEntries({
      available: [BIG],
      enrolledIds: [BIG.courseNumber],
      selectedIds: [],
    });

    // 08:15 UTC is 10:15 in Zurich in September; no offset, so FullCalendar
    // draws 10:15 in New York or Tokyo too.
    expect(entry.start).toBe("2026-09-21T10:15:00");
    expect(entry.end).toBe("2026-09-21T11:45:00");
  });

  it("detects a conflict between two enrolled courses while a filter hides one", () => {
    const enrolledIds = [BIG.courseNumber, OVERLAP.courseNumber];
    const entries = readEntries({
      available: [BIG, OVERLAP, SMALL],
      enrolledIds,
      selectedIds: [],
      // A search for "Stat" leaves only SMALL visible; both 6-ECTS courses
      // are hidden.
      filters: { searchTerm: "Stat" },
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
    });

    const big = entries.find((e) => e.title === "Big Data");
    const small = entries.find((e) => e.title === "Statistics");

    expect(big.color).toBe(ENROLLED_GREEN);
    expect(small.color).toBe(SELECTED_GRAY);
  });

  it("keeps a selected course in the calendar when the keyword filter hides every course", () => {
    const state = {
      available: [BIG, SMALL],
      enrolledIds: [],
      selectedIds: [SMALL.courseNumber],
      filters: { searchTerm: "zzz" },
    };
    const snapshot = snapshotOf(state);

    expect(
      snapshot.getLoadable(filteredCoursesSelector(SEMESTER)).getValue(),
    ).toEqual([]);
    expect(
      snapshot
        .getLoadable(calendarEntriesSelector)
        .getValue()
        .map((e) => e.title),
    ).toEqual(["Statistics"]);
  });

  it("skips entries without a usable eventDate instead of throwing", () => {
    // The Event API sends some entries with an empty eventDate; formatting
    // one threw "Invalid time value" and took down the whole calendar.
    const patchy = {
      ...BIG,
      calendarEntry: [
        { eventDate: null, durationInMinutes: 90 },
        { eventDate: "", durationInMinutes: 90 },
        ...BIG.calendarEntry,
      ],
    };
    const entries = readEntries({
      available: [patchy],
      enrolledIds: [patchy.courseNumber],
      selectedIds: [],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].start).toBe("2026-09-21T10:15:00");
  });
});
