/**
 * The event sheet is the touch stand-in for the hover tooltip, so tapping an
 * event may only open it below md (768px). Desktop already has the tooltip,
 * and the sheet is a full-width Headless UI Dialog: opening it there would dim
 * the course list and the side nav and trap focus in a panel nobody asked for.
 *
 * The gate therefore lives in the click handler (state level), not in a
 * `md:hidden` class — a Dialog that is merely invisible is still mounted and
 * still holds focus.
 *
 * FullCalendar is stubbed down to the one prop under test (eventClick); the
 * Recoil selectors Calendar reads are stubbed to plain values so the component
 * can be driven without a store or a network.
 */

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CALENDAR_ENTRIES = "calendar-entries-selector";
const CURRENT_SEMESTER = "current-semester-selector";
const SELECTED_SEMESTER = "selected-semester-selector";
const EXAM_EVENTS = "exam-calendar-events-selector";
const IS_FUTURE_SEMESTER = "is-future-semester-selector";

const fullCalendar = vi.hoisted(() => ({ props: null }));
const recoil = vi.hoisted(() => ({ values: new Map() }));

vi.mock("@fullcalendar/react", async () => {
  const { forwardRef } = await import("react");
  return {
    default: forwardRef(function FullCalendarStub(props, ref) {
      fullCalendar.props = props;
      return <div ref={ref} data-testid="fullcalendar-stub" />;
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
  useExamSchedule: () => null,
}));
vi.mock("../../recoil/isFutureSemesterSelected", () => ({
  isFutureSemesterSelected: IS_FUTURE_SEMESTER,
}));
vi.mock("recoil", () => ({
  useRecoilValue: (key) => recoil.values.get(key),
}));

const START = new Date("2026-03-02T14:15:00");
const END = new Date("2026-03-02T16:00:00");

const EVENT_ARG = {
  event: {
    title: "Corporate Finance",
    start: START,
    end: END,
    extendedProps: { room: "01-013", conflictsWith: [] },
  },
};

const originalMatchMedia = window.matchMedia;

/** Point matchMedia at a viewport width, the way a real browser answers. */
const setViewportWidth = (width) => {
  window.matchMedia = vi.fn((query) => ({
    matches: query === "(max-width: 767px)" ? width <= 767 : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
};

beforeEach(() => {
  fullCalendar.props = null;
  recoil.values.set(CALENDAR_ENTRIES, [
    { title: "Corporate Finance", start: START, end: END },
  ]);
  recoil.values.set(CURRENT_SEMESTER, "FS26");
  recoil.values.set(SELECTED_SEMESTER, "FS26");
  recoil.values.set(EXAM_EVENTS, []);
  recoil.values.set(IS_FUTURE_SEMESTER, false);
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.resetModules();
});

const renderCalendar = async () => {
  const { default: Calendar } = await import("../Calendar");
  render(<Calendar />);
  return fullCalendar.props.eventClick;
};

const sheet = () => screen.queryByTestId("calendar-event-sheet-panel");

describe("Calendar event sheet viewport gate", () => {
  it("opens the sheet when an event is tapped below md", async () => {
    setViewportWidth(390);
    const clickEvent = await renderCalendar();

    act(() => clickEvent(EVENT_ARG));

    expect(sheet()).toBeInTheDocument();
    expect(screen.getByText("Corporate Finance")).toBeInTheDocument();
    expect(screen.getByText(/01-013/)).toBeInTheDocument();
  });

  it("leaves the sheet closed when an event is clicked at md and above", async () => {
    setViewportWidth(1280);
    const clickEvent = await renderCalendar();

    act(() => clickEvent(EVENT_ARG));

    expect(sheet()).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays closed when matchMedia is unavailable", async () => {
    // jsdom ships none; the handler feature-detects rather than throwing.
    delete window.matchMedia;
    const clickEvent = await renderCalendar();

    expect(() => act(() => clickEvent(EVENT_ARG))).not.toThrow();
    expect(sheet()).toBeNull();
  });

  /**
   * The sheet and the hover tooltip describe the same event, so they must not
   * disagree about the clock — the tooltip uses toLocaleTimeString, and the
   * sheet used to use moment's "hh:mm A".
   */
  it("shows the same clock the hover tooltip uses", async () => {
    setViewportWidth(390);
    const clickEvent = await renderCalendar();

    act(() => clickEvent(EVENT_ARG));

    const asTooltipWouldRender = (date) =>
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    expect(
      screen.getByText(
        `${asTooltipWouldRender(START)} - ${asTooltipWouldRender(END)}`,
      ),
    ).toBeInTheDocument();
  });

  /**
   * Switching semester or removing a course rebuilds the event set; the open
   * sheet would otherwise keep describing an event that no longer exists.
   */
  it("closes the sheet when the event set changes underneath it", async () => {
    setViewportWidth(390);
    const { default: Calendar } = await import("../Calendar");
    const { rerender } = render(<Calendar />);

    act(() => fullCalendar.props.eventClick(EVENT_ARG));
    expect(sheet()).toBeInTheDocument();

    act(() => {
      recoil.values.set(CALENDAR_ENTRIES, [
        { title: "Macroeconomics", start: START, end: END },
      ]);
    });
    rerender(<Calendar />);

    expect(sheet()).toBeNull();
  });
});
