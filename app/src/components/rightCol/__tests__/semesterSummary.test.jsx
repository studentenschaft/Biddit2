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
 */

import { render, screen, within } from "@testing-library/react";
import { RecoilRoot } from "recoil";
import { describe, expect, it, vi } from "vitest";

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
// The exam plan is fetched here in production; the layout under test does not
// depend on it, and the warnings have their own test.
vi.mock("../../helpers/useExamSchedule", () => ({
  useExamSchedule: () => null,
}));

import SemesterSummary from "../SemesterSummary";
import { formatEcts } from "../../helpers/formatEcts";

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
