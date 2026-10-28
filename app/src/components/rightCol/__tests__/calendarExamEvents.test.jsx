/**
 * Exam blocks in the Calendar.
 *
 * Pinned here: exams reach FullCalendar even without a lecture, and the
 * Exams⇄Lectures jump — which exists only when there is something to jump to,
 * says which way it goes, and starts over with each semester. How a block is
 * drawn and what its tooltip and sheet say is pinned against the real
 * FullCalendar in calendarExamBlocks.test.jsx.
 *
 * Same stubbing shape as calendarEventSheetGating.test.jsx: FullCalendar is
 * reduced to the props under test and the Recoil selectors are plain values, so
 * the component can be driven without a store or a network.
 */

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CALENDAR_ENTRIES = "calendar-entries-selector";
const CURRENT_SEMESTER = "current-semester-selector";
const SELECTED_SEMESTER = "selected-semester-selector";
const EXAM_EVENTS = "exam-calendar-events-selector";
const IS_FUTURE_SEMESTER = "is-future-semester-selector";

const fullCalendar = vi.hoisted(() => ({ props: null, api: null }));
const recoil = vi.hoisted(() => ({ values: new Map() }));

vi.mock("@fullcalendar/react", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    default: forwardRef(function FullCalendarStub(props, ref) {
      fullCalendar.props = props;
      useImperativeHandle(ref, () => ({ getApi: () => fullCalendar.api }));
      return <div data-testid="fullcalendar-stub" />;
    }),
  };
});
vi.mock("@fullcalendar/timegrid", () => ({ default: {} }));
vi.mock("@fullcalendar/daygrid", () => ({ default: {} }));

vi.mock("../../recoil/calendarEntriesSelector", () => ({
  calendarEntriesSelector: CALENDAR_ENTRIES,
}));
vi.mock("../../recoil/unifiedCourseDataSelectors", () => ({
  currentSemesterSelector: CURRENT_SEMESTER,
  selectedSemesterSelector: SELECTED_SEMESTER,
}));
vi.mock("../../recoil/examScheduleSelectors", () => ({
  examCalendarEventsSelector: () => EXAM_EVENTS,
}));
vi.mock("../../recoil/isFutureSemesterSelected", () => ({
  isFutureSemesterSelected: IS_FUTURE_SEMESTER,
}));
vi.mock("recoil", () => ({
  useRecoilValue: (key) => recoil.values.get(key),
}));

const LECTURE = {
  title: "Corporate Finance",
  start: new Date("2026-10-05T14:15:00"),
  end: new Date("2026-10-05T16:00:00"),
  room: "01-013",
  conflictsWith: [],
};

// Tuesday of the first exam week — the jump must land on the Monday before it.
const EXAM = {
  id: "ot-cyber",
  title: "Advanced Cybersecurity",
  start: "2027-01-19T15:15:00",
  end: "2027-01-19T17:15:00",
  entryType: "exam",
  examDate: "Tue 19.01.2027",
  examMeta: "Exam · 120 min · digital (BYOD)",
  conflictsWith: [],
};

// "Today" for the calendar: a Monday in HS26's lecture weeks.
const TODAY = new Date("2026-10-05T12:00:00");

// The viewport-gate contract itself is owned by calendarEventSheetGating.test.jsx.
vi.mock("../../helpers/isMobileViewport", () => ({
  isMobileViewport: () => true,
}));

beforeEach(() => {
  // Only Date: React, Headless UI and the test helpers keep real timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
  fullCalendar.props = null;
  fullCalendar.api = {
    gotoDate: vi.fn(),
    getDate: () => new Date("2026-10-05T00:00:00"),
    next: vi.fn(),
    prev: vi.fn(),
    today: vi.fn(),
  };
  recoil.values.set(CALENDAR_ENTRIES, [LECTURE]);
  recoil.values.set(CURRENT_SEMESTER, "HS26");
  recoil.values.set(SELECTED_SEMESTER, "HS26");
  recoil.values.set(EXAM_EVENTS, [EXAM]);
  recoil.values.set(IS_FUTURE_SEMESTER, false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

const renderCalendar = async () => {
  const { default: Calendar } = await import("../Calendar");
  return render(<Calendar />);
};

const examJumpButtons = () =>
  screen.queryAllByRole("button", { name: /^(Exams|Lectures)$/ });
/** One per navigation cluster: the mobile toolbar, then the desktop column. */
const jumpButtons = (name) => screen.queryAllByRole("button", { name });
const click = (name) =>
  act(() => screen.getAllByRole("button", { name })[0].click());

describe("Calendar exam blocks", () => {
  // A plan can list the user's exams before any of their lectures is
  // scheduled; the calendar must not call that empty.
  it("shows the exams and the jump when there is no lecture", async () => {
    recoil.values.set(CALENDAR_ENTRIES, []);
    await renderCalendar();

    expect(fullCalendar.props.events).toEqual([EXAM]);
    expect(jumpButtons("Exams")).toHaveLength(2);
  });

  it("hides the jump when the semester has no exam blocks", async () => {
    recoil.values.set(EXAM_EVENTS, []);
    await renderCalendar();

    expect(examJumpButtons()).toHaveLength(0);
  });

  it("jumps to the Monday of the first exam week and back again", async () => {
    await renderCalendar();

    expect(jumpButtons("Exams")).toHaveLength(2);

    click("Exams");

    const target = fullCalendar.api.gotoDate.mock.calls[0][0];
    expect(target.getDay()).toBe(1);
    expect(target.getMonth()).toBe(0);
    expect(target.getDate()).toBe(18);

    // The button now offers the way back to where the user was.
    expect(jumpButtons("Lectures")).toHaveLength(2);

    click("Lectures");

    expect(fullCalendar.api.gotoDate).toHaveBeenLastCalledWith(TODAY);
    expect(jumpButtons("Exams")).toHaveLength(2);
  });

  /**
   * A 320px phone has no room for the word in its toolbar, so there the jump
   * is an icon named by its label; on desktop the visible word is the whole
   * name, so speech input can say what it sees (WCAG 2.5.3).
   */
  it("is named by what it shows: a word on desktop, a label on the mobile icon", async () => {
    await renderCalendar();

    const [mobile, desktop] = jumpButtons("Exams");
    expect(mobile).toHaveAttribute("aria-label", "Exams");
    expect(mobile.textContent).toBe("");
    expect(desktop).not.toHaveAttribute("aria-label");
    expect(desktop).toHaveTextContent("Exams");
  });

  it("offers the exams again once the calendar is past the exam weeks", async () => {
    // A second exam makes the exam weeks Mon 18.01. to Sun 07.02.2027.
    recoil.values.set(EXAM_EVENTS, [
      EXAM,
      {
        ...EXAM,
        id: "ot-late",
        start: "2027-02-05T09:15:00",
        end: "2027-02-05T10:45:00",
      },
    ]);
    await renderCalendar();

    fullCalendar.api.getDate = () => new Date("2027-02-01T00:00:00");
    click("Next week");
    expect(jumpButtons("Lectures")).toHaveLength(2);

    fullCalendar.api.getDate = () => new Date("2027-02-08T00:00:00");
    click("Next week");
    expect(jumpButtons("Exams")).toHaveLength(2);
  });

  /**
   * The jump remembered the old semester: switching after a jump left the
   * calendar on the old term's exam week, labelled "Lectures", and the way
   * back led to the old term's lectures.
   */
  it("starts over when the semester changes", async () => {
    const { default: Calendar } = await import("../Calendar");
    const { rerender } = render(<Calendar />);
    click("Exams");

    // FS26: lectures from March, exams in June 2026.
    const fs26Lecture = {
      ...LECTURE,
      start: new Date("2026-03-02T10:15:00"),
      end: new Date("2026-03-02T12:00:00"),
    };
    recoil.values.set(SELECTED_SEMESTER, "FS26");
    recoil.values.set(CALENDAR_ENTRIES, [fs26Lecture]);
    recoil.values.set(EXAM_EVENTS, [
      {
        ...EXAM,
        id: "ot-fs26",
        start: "2026-06-16T09:15:00",
        end: "2026-06-16T11:15:00",
      },
    ]);
    rerender(<Calendar />);

    // Back on today, which is outside FS26's exam weeks.
    expect(fullCalendar.props.initialDate).toEqual(TODAY);
    expect(jumpButtons("Exams")).toHaveLength(2);

    // Walking into FS26's exam weeks and taking the way back lands on FS26's
    // lectures, not on the HS26 week the first jump left.
    fullCalendar.api.getDate = () => new Date("2026-06-15T00:00:00");
    click("Next week");
    click("Lectures");
    expect(fullCalendar.api.gotoDate).toHaveBeenLastCalledWith(
      fs26Lecture.start,
    );
  });

  it("still opens a future semester on its first lecture, not on today", async () => {
    const { default: Calendar } = await import("../Calendar");
    const { rerender } = render(<Calendar />);

    const projectedLecture = {
      ...LECTURE,
      start: new Date("2027-02-22T10:15:00"),
      end: new Date("2027-02-22T12:00:00"),
    };
    recoil.values.set(SELECTED_SEMESTER, "FS27");
    recoil.values.set(IS_FUTURE_SEMESTER, true);
    recoil.values.set(CALENDAR_ENTRIES, [projectedLecture]);
    recoil.values.set(EXAM_EVENTS, []);
    rerender(<Calendar />);

    expect(fullCalendar.props.initialDate).toEqual(projectedLecture.start);
  });
});
