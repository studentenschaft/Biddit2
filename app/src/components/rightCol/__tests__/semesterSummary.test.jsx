/**
 * The semester summary table, as seen on a phone.
 *
 * Two things broke at 390px and are pinned here. First the header row: twelve
 * equal grid tracks minus eleven 16px gaps left ~14px per track, so the
 * single-track "Events" and "ECTS" labels overflowed and painted over each
 * other ("EvenBCTS" in the bug report). Second the numbers: ECTS rendered as
 * "6.00" / "0.00" / "20.00" because they went through toFixed(2).
 *
 * jsdom computes no layout, so the layout half is pinned as the classes the
 * fix relies on — content-sized numeric tracks that never wrap, truncating
 * text cells, a smaller gap below md — plus the untouched md+ twelve-column
 * layout.
 *
 * Then the exam warnings: a clashing course's red marker and tooltip, and the
 * "Exam check" line that says whether no red means "checked, no clash".
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { RecoilRoot } from "recoil";
import { describe, expect, it, vi } from "vitest";
import { mockData } from "../../../test/mocks/handlers";

const { COURSES } = vi.hoisted(() => ({
  COURSES: [
    // credits arrive in hundredths: 600 = 6 ECTS.
    {
      id: "1",
      courseNumber: "1,000",
      shortName: "Whole",
      classification: "Core",
      credits: 600,
    },
    {
      id: "2",
      courseNumber: "2,000",
      shortName: "Zero",
      classification: "Exercise group",
      credits: 0,
    },
    {
      id: "3",
      courseNumber: "3,000",
      shortName: "Fractional",
      classification: "Elective",
      credits: 750,
    },
    {
      id: "4",
      courseNumber: "4,000",
      shortName: "Thesis",
      classification: "Contextual",
      credits: 2000,
    },
  ],
}));

vi.mock("../../recoil/unifiedCourseDataSelectors", async () => {
  const { atom, atomFamily } = await import("recoil");
  return {
    selectedSemesterSelector: atom({
      key: "test-selectedSemester",
      default: "FS26",
    }),
    semesterCoursesSelector: atomFamily({
      key: "test-semesterCourses",
      default: ({ type }) => (type === "enrolled" ? COURSES : []),
    }),
    myCoursesSelector: atomFamily({
      key: "test-myCourses",
      default: COURSES,
    }),
    semesterMetadataSelector: atomFamily({
      key: "test-semesterMetadata",
      default: {},
    }),
  };
});

vi.mock("../../recoil/calendarEntriesSelector", async () => {
  const { atom } = await import("recoil");
  return {
    calendarEntriesSelector: atom({ key: "test-calendarEntries", default: [] }),
  };
});

// The summary is what is under test; its neighbours drag in the whole auth and
// course-selection stack and have tests of their own.
vi.mock("../Heatmap", () => ({ Heatmap: () => null }));
vi.mock("../../leftCol/bottomRow/LockOpen", () => {
  const LockOpen = () => null;
  return { default: LockOpen, LockOpen };
});
vi.mock("../../leftCol/bottomRow/LockClosed", () => {
  const LockClosed = () => null;
  return { default: LockClosed, LockClosed };
});
vi.mock("../../helpers/useOpenCourseDetails", () => ({
  useOpenCourseDetails: () => vi.fn(),
}));

import SemesterSummary from "../SemesterSummary";
import { formatEcts } from "../../helpers/formatEcts";
import {
  myCoursesSelector,
  selectedSemesterSelector,
} from "../../recoil/unifiedCourseDataSelectors";
import { calendarEntriesSelector } from "../../recoil/calendarEntriesSelector";
import { examPlanState } from "../../recoil/examScheduleAtom";

const renderSummary = () =>
  render(
    <RecoilRoot>
      <SemesterSummary />
    </RecoilRoot>,
  );

/** The grid row a given cell belongs to. */
const rowOf = (cell) => cell.closest("div.grid");

describe("semester summary ECTS formatting", () => {
  it("drops decimals that carry no information", () => {
    expect(formatEcts(6)).toBe("6");
    expect(formatEcts(0)).toBe("0");
    expect(formatEcts(20)).toBe("20");
  });

  it("keeps a genuine fraction", () => {
    expect(formatEcts(7.5)).toBe("7.5");
    expect(formatEcts(2.25)).toBe("2.25");
  });

  it("coerces the numeric strings the course API sometimes sends", () => {
    expect(formatEcts("6")).toBe("6");
    expect(formatEcts("7.5")).toBe("7.5");
  });

  it("sheds the float noise of a summed column without rounding it", () => {
    // 0.1 + 0.2 territory: a sum of hundredths, not a real 17-decimal value.
    expect(formatEcts(0.1 + 0.2)).toBe("0.3");
    expect(formatEcts(1.1 + 2.2)).toBe("3.3");
  });

  it("falls back to 0 rather than rendering NaN", () => {
    expect(formatEcts(undefined)).toBe("0");
    expect(formatEcts("n/a")).toBe("0");
  });

  it("renders whole credits without trailing zeros, per row and in the total", () => {
    renderSummary();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("7.5")).toBeInTheDocument();
    // 6 + 0 + 7.5 + 20
    expect(screen.getByText("33.5")).toBeInTheDocument();
    expect(screen.queryByText(/^\d+\.\d0$/)).not.toBeInTheDocument();
  });
});

describe("semester summary column layout", () => {
  it("gives the numeric headers their own tracks and forbids them wrapping", () => {
    renderSummary();
    const events = screen.getByText("Events");
    const ects = screen.getByText("ECTS");
    // A wrapped or overflowing label is exactly how the two ended up painted
    // on top of one another at 390px.
    expect(events.className).toContain("whitespace-nowrap");
    expect(ects.className).toContain("whitespace-nowrap");
    expect(events.className).not.toContain("truncate");
    expect(ects.className).not.toContain("truncate");

    const header = rowOf(events);
    expect(rowOf(ects)).toBe(header);
    // Content-sized tracks for the numbers, shrinkable ones for the text.
    expect(header.className).toContain(
      "grid-cols-[auto_minmax(0,1fr)_minmax(0,0.9fr)_3.5rem_3rem]",
    );
    expect(header.className).toContain("gap-2");
  });

  it("leaves the desktop layout on the original twelve columns", () => {
    renderSummary();
    const header = rowOf(screen.getByText("Events"));
    expect(header.className).toContain("md:grid-cols-12");
    expect(header.className).toContain("md:gap-4");
    expect(within(header).getByText("Course").className).toContain(
      "md:col-span-6",
    );
    expect(within(header).getByText("Classification").className).toContain(
      "md:col-span-3",
    );
  });

  it("truncates the text cells instead of letting them push the numbers", () => {
    renderSummary();
    const course = screen.getByText("Fractional");
    expect(course.className).toContain("truncate");
    expect(course.className).toContain("min-w-0");
    // min-w-0 is the half that actually lets a grid item shrink.
    expect(screen.getByText("Elective").className).toContain("truncate");
  });

  it("keeps every row on the same five-cell template as the header", () => {
    renderSummary();
    const header = rowOf(screen.getByText("Events"));
    const total = rowOf(screen.getByText("Total"));
    const courseRow = rowOf(screen.getByText("Fractional"));
    [total, courseRow].forEach((row) => {
      expect(row.className).toContain(
        "grid-cols-[auto_minmax(0,1fr)_minmax(0,0.9fr)_3.5rem_3rem]",
      );
      // A sixth cell in the total row used to wrap onto a phantom grid row.
      expect(row.childElementCount).toBe(header.childElementCount);
    });
  });
});

// The MSW exam fixture puts 3,200 and 7,850 in the same 18.01.2027 09:15 slot;
// 3,140 sits a different date entirely.
const MICRO = {
  id: "micro",
  courseNumber: "3,200,1.00",
  shortName: "Microeconomics II",
  classification: "Core",
  credits: 400,
};
// A real title with a comma in it: names must not be split at commas.
const MACRO_TITLE =
  "Advanced Macroeconomics II: Asset Prices, Fluctuations and Unemployment";
const MACRO = {
  id: "macro",
  courseNumber: "7,850,1.00",
  shortName: MACRO_TITLE,
  classification: "Elective",
  credits: 400,
};
const OPS = {
  id: "ops",
  courseNumber: "3,140,1.00",
  shortName: "Operations Management",
  classification: "Core",
  credits: 400,
};

const READY = { status: "ready", plan: mockData.examSchedule };
const SOURCE =
  "Winter 2027 plan, published 18.08.2026. Indicative — verify officially.";

const renderExamSummary = ({
  courses = [MICRO, MACRO, OPS],
  planState = READY,
  calendarEntries = [],
} = {}) =>
  render(
    <RecoilRoot
      initializeState={({ set }) => {
        set(selectedSemesterSelector, "HS26");
        set(myCoursesSelector("HS26"), courses);
        set(examPlanState("HS26"), planState);
        set(calendarEntriesSelector, calendarEntries);
      }}
    >
      <SemesterSummary />
    </RecoilRoot>,
  );

/** Hovers the row's conflict marker and returns the tooltip it opens. */
const openTooltipOf = async (shortName) => {
  fireEvent.mouseEnter(
    rowOf(screen.getByText(shortName)).querySelector("[data-tooltip-id]"),
  );
  return screen.findByRole("tooltip");
};

const CLASH_WITH_MACRO = `Exam clash with: ${MACRO_TITLE}. Indicative — verify officially.`;

// The tooltip positions itself with floating-ui, which watches the anchor's
// size; jsdom has no ResizeObserver. Stubbed for the whole file, as the
// tooltip can still be settling when a test ends.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

describe("semester summary exam clashes", () => {
  it("marks a clashing course with a red icon that names the other course", () => {
    renderExamSummary();

    const icon = within(rowOf(screen.getByText("Microeconomics II"))).getByRole(
      "img",
      { name: CLASH_WITH_MACRO },
    );
    expect(icon).toHaveClass("text-danger");
    expect(
      within(rowOf(screen.getByText(MACRO_TITLE))).getByRole("img", {
        name: "Exam clash with: Microeconomics II. Indicative — verify officially.",
      }),
    ).toBeInTheDocument();
    expect(
      within(rowOf(screen.getByText("Operations Management"))).queryByRole(
        "img",
      ),
    ).not.toBeInTheDocument();
  });

  it("lists a comma-containing title whole in the tooltip", async () => {
    renderExamSummary();

    const tooltip = await openTooltipOf("Microeconomics II");
    const exam = within(tooltip).getByText("Exam clash with:").parentElement;
    expect(exam).toHaveClass("text-red-300");
    const names = within(exam).getAllByRole("listitem");
    expect(names.map((name) => name.textContent)).toEqual([MACRO_TITLE]);
    expect(names[0]).toHaveClass("break-words");
    expect(names[0]).not.toHaveClass("truncate");
    expect(
      within(exam).getByText("Indicative — verify officially."),
    ).toBeInTheDocument();
  });

  it("keeps the lecture-overlap tooltip amber, with comma titles whole", async () => {
    renderExamSummary({
      courses: [MICRO, OPS],
      planState: { status: "loading", plan: null },
      calendarEntries: [
        { courseNumber: MICRO.courseNumber, conflictsWith: [MACRO_TITLE] },
      ],
    });

    const tooltip = await openTooltipOf("Microeconomics II");
    const lecture =
      within(tooltip).getByText("⚠ Conflicts with:").parentElement;
    expect(lecture).toHaveClass("text-amber-300");
    expect(
      within(lecture)
        .getAllByRole("listitem")
        .map((name) => name.textContent),
    ).toEqual([MACRO_TITLE]);
    expect(within(tooltip).queryByText("Exam clash with:")).toBeNull();
  });

  it("names a course once however many of its exams clash with it", () => {
    const secondSitting = (root) => ({
      ...mockData.examSchedule.written[0],
      id: `OT-2027-02-10-0915-${root}`,
      date: "2027-02-10",
      startIso: "2027-02-10T09:15:00+01:00",
      rootNumbers: [root],
    });
    renderExamSummary({
      planState: {
        status: "ready",
        plan: {
          ...mockData.examSchedule,
          written: [
            ...mockData.examSchedule.written,
            secondSitting("3,200"),
            secondSitting("7,850"),
          ],
        },
      },
    });

    expect(screen.getAllByRole("img", { name: CLASH_WITH_MACRO })).toHaveLength(
      1,
    );
    // Two sittings each for two courses.
    expect(
      screen.getByText(
        `Exam check: 4 exams clash — see the red markers. ${SOURCE}`,
      ),
    ).toBeInTheDocument();
  });
});

describe("semester summary exam check", () => {
  it("counts the clashing exams and points at the red markers", () => {
    renderExamSummary();

    expect(
      screen.getByText(
        `Exam check: 2 exams clash — see the red markers. ${SOURCE}`,
      ),
    ).toBeInTheDocument();
  });

  it("says so when one exam clashes", () => {
    // Pins the singular wording on a synthetic plan. Exam B is cross-listed
    // with 3,200 and 7,850 and overlaps 3,200's exam A. An exam also sat by
    // one of a course's own roots is never a clash for that course, so B
    // against A is a self-overlap for Micro, not a clash between two
    // courses; for Macro, B clashes with Micro's A. One exam clashes: B.
    const [a, b] = mockData.examSchedule.written;
    renderExamSummary({
      courses: [MICRO, MACRO],
      planState: {
        status: "ready",
        plan: {
          ...mockData.examSchedule,
          written: [a, { ...b, rootNumbers: ["3,200", "7,850"] }],
        },
      },
    });

    expect(
      screen.getByText(
        `Exam check: 1 exam clashes — see the red markers. ${SOURCE}`,
      ),
    ).toBeInTheDocument();
  });

  it("says a ready plan found no clash", () => {
    renderExamSummary({ courses: [MICRO, OPS] });

    expect(
      screen.getByText(
        `Exam check: no clashes between your central written exams. ${SOURCE}`,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it.each([
    [
      "no plan",
      { status: "none", plan: null },
      "Exam check unavailable: no central exam plan for this semester.",
    ],
    [
      "a failed plan",
      { status: "error", plan: null },
      "Exam check unavailable: the exam plan could not be loaded — reload to retry.",
    ],
  ])("says the check is unavailable with %s", (_, planState, message) => {
    renderExamSummary({ planState });

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("says nothing while the plan loads", () => {
    renderExamSummary({ planState: { status: "loading", plan: null } });

    expect(screen.getByText("Microeconomics II")).toBeInTheDocument();
    expect(screen.queryByText(/Exam check/)).not.toBeInTheDocument();
  });
});
