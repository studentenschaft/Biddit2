/**
 * Exam blocks as the student meets them: the real selectors, the real
 * FullCalendar and the real tooltip, with only the store seeded. What is
 * pinned is what a block looks like (an exam is an outline that leads with its
 * start time and says so when it clashes; a lecture is unchanged)
 * and what the tooltip tells a keyboard user as well as a mouse user.
 *
 * The calendar opens on today, so every test first takes the "Exams" jump to
 * the week of 18.01.2027, where the fixture puts two clashing exams, a
 * 60-minute one and a lecture.
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { RecoilRoot } from "recoil";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { examPlanState } from "../../recoil/examScheduleAtom";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import Calendar from "../Calendar";

// The tooltip positions itself with floating-ui, which watches the anchor's
// size; jsdom has no ResizeObserver.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const SEMESTER = "HS26";

const MICRO = {
  id: "micro",
  courseNumber: "3,200,1.00",
  shortName: "Microeconomics II",
};
// A comma in the title: a comma-joined attribute would split it in two.
const CAUSAL = {
  id: "causal",
  courseNumber: "7,850,1.00",
  shortName: "Data Analytics, Causal Inference",
};
const OPS = {
  id: "ops",
  courseNumber: "3,140,1.00",
  shortName: "Operations Management",
};
// No exam; a block course that meets in the exam week, so a lecture and exams
// share one view.
const LAW = {
  id: "law",
  courseNumber: "5,500,1.00",
  shortName: "Business Law",
  calendarEntry: [
    // 14:15 in Zurich, as a UTC instant like the course API's.
    { eventDate: "2027-01-20T13:15:00Z", durationInMinutes: 105, room: "01-013" },
  ],
};

const exam = (id, startIso, durationMin, root, extra = {}) => ({
  id,
  date: startIso.slice(0, 10),
  slot: startIso.slice(11, 16),
  startIso,
  durationMin,
  termType: "OT",
  rootNumbers: [root],
  title: id,
  ...extra,
});

const PLAN = {
  schemaVersion: 2,
  written: [
    exam("ot-micro", "2027-01-18T09:15:00+01:00", 90, "3,200", { byod: true }),
    exam("ot-causal", "2027-01-18T09:15:00+01:00", 120, "7,850"),
    exam("ot-ops", "2027-01-19T15:15:00+01:00", 60, "3,140"),
  ],
  oral: [],
};

const COURSES = [MICRO, CAUSAL, OPS, LAW];

const renderExamWeek = async () => {
  render(
    <RecoilRoot
      initializeState={({ set }) => {
        set(unifiedCourseDataState, {
          semesters: {
            [SEMESTER]: {
              enrolledIds: COURSES.map((course) => course.courseNumber),
              available: COURSES,
              selectedIds: [],
              filtered: COURSES,
              studyPlan: [],
              ratings: {},
              cisId: "cis-hs26",
              isCurrent: true,
            },
          },
          selectedSemester: SEMESTER,
          latestValidTerm: SEMESTER,
          selectedCourseInfo: null,
        });
        set(examPlanState(SEMESTER), { status: "ready", plan: PLAN });
      }}
    >
      <Calendar />
    </RecoilRoot>,
  );
  fireEvent.click(screen.getAllByText("Exams")[0]);
  // The tooltip learns of new anchors through a MutationObserver, a microtask
  // after FullCalendar draws them; that update has to land inside act().
  await act(async () => {});
};

/** The FullCalendar event element that carries a course's block. */
const block = (title) => screen.getByText(title).closest(".fc-event");
/** FullCalendar applies an event's `textColor` to this inner element. */
const textColor = (element) =>
  element.querySelector(".fc-event-main").style.color;

describe("Calendar exam blocks", () => {
  it("draws an exam as an outline that leads with its start time", async () => {
    await renderExamWeek();
    const ops = block("Operations Management");

    expect(ops.style.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(ops.style.borderColor).toBe("rgb(0, 82, 30)");
    expect(textColor(ops)).toBe("rgb(0, 82, 30)");
    expect(ops).toHaveClass("exam-block", "!border-2");
    expect(ops).not.toHaveClass("!border-dashed");
    // The time first, so a narrow block cuts it the way it cuts a lecture's,
    // and a 60-minute block still has it when the rest is cut off below.
    expect(ops.textContent).toMatch(/^15:15 · Exam/);
  });

  it("marks a clashing exam by a dashed border and in words, not only in red", async () => {
    await renderExamWeek();
    const micro = block("Microeconomics II");

    expect(micro.style.borderColor).toBe("rgb(220, 38, 38)");
    expect(textColor(micro)).toBe("rgb(220, 38, 38)");
    expect(micro).toHaveClass("!border-dashed");
    expect(within(micro).getByText("Clash")).toBeInTheDocument();
    expect(within(block("Operations Management")).queryByText("Clash")).toBeNull();
  });

  it("leaves a lecture block as it was, on a 24-hour clock", async () => {
    await renderExamWeek();
    const law = block("Business Law");

    expect(law.style.backgroundColor).toBe("rgb(0, 102, 37)");
    expect(law).not.toHaveClass("!border-2");
    expect(within(law).getByText("14:15 - 16:00")).toBeInTheDocument();
    expect(within(law).getByText("01-013")).toBeInTheDocument();
    expect(within(law).queryByText(/Exam/)).toBeNull();
  });
});

/**
 * HSG runs on Zurich time, so the calendar does too, wherever the student
 * reads it. In the reader's own zone a 09:15 exam fell before the calendar's
 * 08:00 start in New York, and a 14:15 lecture after its 22:00 end in Tokyo.
 */
describe.each(["America/New_York", "Asia/Tokyo"])(
  "Calendar read in %s",
  (zone) => {
    beforeEach(() => vi.stubEnv("TZ", zone));
    afterEach(() => vi.unstubAllEnvs());

    it("shows lectures and exams at St. Gallen time", async () => {
      await renderExamWeek();

      expect(
        within(block("Business Law")).getByText("14:15 - 16:00"),
      ).toBeInTheDocument();
      expect(block("Microeconomics II").textContent).toMatch(/^09:15 · Exam/);

      // The time Course Details prints from the plan's slot.
      act(() => block("Microeconomics II").focus());
      const tooltip = await screen.findByRole("tooltip");
      expect(
        within(tooltip).getByText("Mon 18.01.2027, 09:15 - 10:45"),
      ).toBeInTheDocument();
    });
  },
);

describe("Calendar event tooltip", () => {
  it("hands a block's details to the tooltip as soon as it is drawn", async () => {
    await renderExamWeek();
    const micro = block("Microeconomics II");

    // No pointer has been near the block.
    expect(micro).toHaveAttribute("data-tooltip-id", "event-tooltip");
    expect(JSON.parse(micro.getAttribute("data-event"))).toMatchObject({
      examDate: "Mon 18.01.2027",
      conflictsWith: ["Data Analytics, Causal Inference"],
    });
  });

  it("opens on keyboard focus with the exam's date, facts and clashes", async () => {
    await renderExamWeek();

    act(() => block("Microeconomics II").focus());

    const tooltip = await screen.findByRole("tooltip");
    expect(
      within(tooltip).getByText("Mon 18.01.2027, 09:15 - 10:45"),
    ).toBeInTheDocument();
    expect(
      within(tooltip).getByText("Exam · 90 min · digital (BYOD)"),
    ).toBeInTheDocument();
    expect(within(tooltip).getByText("⚠ Exam clash with:")).toBeInTheDocument();
    expect(
      within(tooltip)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Data Analytics, Causal Inference"]);
    expect(
      within(tooltip).getByText("Indicative — verify officially."),
    ).toBeInTheDocument();
    expect(within(tooltip).queryByText(/Room:/)).toBeNull();
  });

  it("shows a lecture's room and 24-hour times", async () => {
    await renderExamWeek();

    act(() => block("Business Law").focus());

    const tooltip = await screen.findByRole("tooltip");
    expect(within(tooltip).getByText("Room: 01-013")).toBeInTheDocument();
    expect(within(tooltip).getByText("14:15 - 16:00")).toBeInTheDocument();
    expect(within(tooltip).queryByText(/Indicative/)).toBeNull();
  });

  it("can be dismissed with Escape without moving focus", async () => {
    await renderExamWeek();
    act(() => block("Operations Management").focus());
    await screen.findByRole("tooltip");

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });
});

/**
 * One detail view per viewport. A tap on a phone fires mouseover and focus as
 * well as click, and the blocks are focusable, so without a gate the tooltip
 * would open on top of the event sheet (and reopen when the sheet hands focus
 * back). Below md the sheet is the only detail view.
 */
describe("Calendar event details on a phone", () => {
  const originalMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  /** A 390px viewport, answered the way a browser answers matchMedia. */
  const onAPhone = () => {
    window.matchMedia = (query) => ({
      matches: query === "(max-width: 767px)",
      media: query,
      addEventListener() {},
      removeEventListener() {},
    });
  };

  /** Long enough for the tooltip to have opened: it shows 10ms after its trigger. */
  const settle = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

  // Also stands for the focus the sheet hands back to the block on closing.
  it("does not open the tooltip on the mouseover and focus a tap fires", async () => {
    onAPhone();
    await renderExamWeek();
    const micro = block("Microeconomics II");

    fireEvent.mouseOver(micro);
    act(() => micro.focus());
    await settle();

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens the sheet on a tap", async () => {
    onAPhone();
    await renderExamWeek();
    const micro = block("Microeconomics II");

    act(() => micro.focus());
    fireEvent.click(micro);
    // Only the Dialog's own tick: a longer wait lets FullCalendar 6.0.3 redraw
    // through react-dom/test-utils' deprecated act(), which warns.
    await act(async () => {});

    const sheet = screen.getByTestId("calendar-event-sheet-panel");
    expect(
      within(sheet).getByText("Mon 18.01.2027, 09:15 - 10:45"),
    ).toBeInTheDocument();
  });
});
