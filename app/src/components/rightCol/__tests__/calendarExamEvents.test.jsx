/**
 * Exam blocks in the Calendar (ADR 0010).
 *
 * Three things are pinned here: exam events reach FullCalendar without going
 * through `calendarEntriesSelector`, an exam block reads as an exam rather than
 * a lecture (badge instead of room, disclaimer on the detail surfaces), and the
 * "Exams" jump only exists when there is something to jump to.
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
const examSchedule = vi.hoisted(() => ({ semester: undefined }));

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
vi.mock("../../helpers/useExamSchedule", () => ({
  useExamSchedule: (semester) => {
    examSchedule.semester = semester;
    return null;
  },
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
  start: "2027-01-19T15:15:00+01:00",
  end: "2027-01-19T17:15:00+01:00",
  entryType: "exam",
  durationMin: 120,
  byod: true,
  conflictsWith: [],
  color: "#00521E",
};

// The viewport-gate contract itself is owned by calendarEventSheetGating.test.jsx.
vi.mock("../../helpers/isMobileViewport", () => ({
  isMobileViewport: () => true,
}));

beforeEach(() => {
  fullCalendar.props = null;
  fullCalendar.api = {
    gotoDate: vi.fn(),
    getDate: () => new Date("2026-10-05T00:00:00"),
    next: vi.fn(),
    prev: vi.fn(),
    today: vi.fn(),
  };
  examSchedule.semester = undefined;
  recoil.values.set(CALENDAR_ENTRIES, [LECTURE]);
  recoil.values.set(CURRENT_SEMESTER, "HS26");
  recoil.values.set(SELECTED_SEMESTER, "HS26");
  recoil.values.set(EXAM_EVENTS, [EXAM]);
  recoil.values.set(IS_FUTURE_SEMESTER, false);
});

afterEach(() => {
  vi.resetModules();
});

const renderCalendar = async () => {
  const { default: Calendar } = await import("../Calendar");
  return render(<Calendar />);
};

/** Runs the eventContent renderer FullCalendar would call for an event. */
const renderEventBody = (event) =>
  render(
    <>
      {fullCalendar.props.eventContent({
        timeText: "15:15 - 17:15",
        event: { title: event.title, _def: { extendedProps: event } },
      })}
    </>,
  );

const examJumpButtons = () => screen.queryAllByRole("button", { name: /exam period|lecture weeks/i });

describe("Calendar exam blocks", () => {
  it("feeds exam events to FullCalendar alongside the lectures", async () => {
    await renderCalendar();

    expect(fullCalendar.props.events).toEqual([LECTURE, EXAM]);
  });

  it("loads the exam plan for the semester the lectures come from", async () => {
    await renderCalendar();

    expect(examSchedule.semester).toBe("HS26");
  });

  it("marks an exam block with a badge instead of a room", async () => {
    await renderCalendar();
    renderEventBody(EXAM);

    expect(screen.getByText("Exam")).toBeInTheDocument();
  });

  it("still shows the room on a lecture block", async () => {
    await renderCalendar();
    renderEventBody({ ...LECTURE, entryType: undefined });

    expect(screen.getByText("01-013")).toBeInTheDocument();
    expect(screen.queryByText("Exam")).not.toBeInTheDocument();
  });

  it("shows duration, BYOD and the disclaimer when an exam is tapped", async () => {
    await renderCalendar();

    act(() =>
      fullCalendar.props.eventClick({
        event: {
          title: EXAM.title,
          start: new Date(EXAM.start),
          end: new Date(EXAM.end),
          extendedProps: EXAM,
        },
      }),
    );

    expect(screen.getByText(/Exam · 120 min · digital \(BYOD\)/)).toBeInTheDocument();
    expect(screen.getByText("Indicative — verify officially.")).toBeInTheDocument();
    // The plan publishes no room for exams, so the sheet must not claim one.
    expect(screen.queryByText(/^Room:/)).not.toBeInTheDocument();
  });

  it("hides the jump when the semester has no exam blocks", async () => {
    recoil.values.set(EXAM_EVENTS, []);
    await renderCalendar();

    expect(examJumpButtons()).toHaveLength(0);
  });

  it("jumps to the Monday of the first exam week and back again", async () => {
    await renderCalendar();

    // One button per navigation cluster (mobile toolbar, desktop column).
    expect(examJumpButtons().length).toBeGreaterThan(0);
    expect(screen.getAllByText("Exams").length).toBeGreaterThan(0);

    act(() => examJumpButtons()[0].click());

    const target = fullCalendar.api.gotoDate.mock.calls[0][0];
    expect(target.getDay()).toBe(1);
    expect(target.getMonth()).toBe(0);
    expect(target.getDate()).toBe(18);

    // The button now offers the way back to where the user was.
    expect(screen.getAllByText("Lectures").length).toBeGreaterThan(0);

    act(() => examJumpButtons()[0].click());

    const back = fullCalendar.api.gotoDate.mock.calls[1][0];
    expect(back.getFullYear()).toBe(2026);
    expect(screen.getAllByText("Exams").length).toBeGreaterThan(0);
  });
});
