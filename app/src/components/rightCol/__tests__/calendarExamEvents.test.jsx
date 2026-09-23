/**
 * Exam blocks in the Calendar.
 *
 * Three things are pinned here: exam events reach FullCalendar without going
 * through `calendarEntriesSelector`, a tapped exam reads as an exam rather than
 * a lecture (date and facts instead of a room, disclaimer), and the "Exams"
 * jump only exists when there is something to jump to. How a block is drawn
 * and what its tooltip says is pinned against the real FullCalendar in
 * calendarExamBlocks.test.jsx.
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
const examEvents = vi.hoisted(() => ({ semester: undefined }));

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
  examCalendarEventsSelector: (semester) => {
    examEvents.semester = semester;
    return EXAM_EVENTS;
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
  examDate: "Tue 19.01.2027",
  examMeta: "Exam · 120 min · digital (BYOD)",
  conflictsWith: [],
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
  examEvents.semester = undefined;
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

const examJumpButtons = () => screen.queryAllByRole("button", { name: /exam period|lecture weeks/i });

describe("Calendar exam blocks", () => {
  it("feeds exam events to FullCalendar alongside the lectures", async () => {
    await renderCalendar();

    expect(fullCalendar.props.events).toEqual([LECTURE, EXAM]);
  });

  it("reads the exams of the semester the lectures come from", async () => {
    await renderCalendar();

    expect(examEvents.semester).toBe("HS26");
  });

  it("shows the date, the exam facts and the disclaimer when an exam is tapped", async () => {
    await renderCalendar();

    await act(async () =>
      fullCalendar.props.eventClick({
        event: {
          title: EXAM.title,
          start: new Date(EXAM.start),
          end: new Date(EXAM.end),
          extendedProps: EXAM,
        },
      }),
    );

    expect(screen.getByText(/^Tue 19\.01\.2027, /)).toBeInTheDocument();
    expect(screen.getByText("Exam · 120 min · digital (BYOD)")).toBeInTheDocument();
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
