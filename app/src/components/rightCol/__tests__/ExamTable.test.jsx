/**
 * The Summary's exam table: the central exams of the user's courses, soonest
 * first, under a warning that the dates are our own extraction; nothing at all
 * while there is no ready plan listing one of them.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { RecoilRoot } from "recoil";
import { describe, expect, it, vi } from "vitest";
import { mockData } from "../../../test/mocks/handlers";
import { examPlanState } from "../../recoil/examScheduleAtom";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import ExamTable from "../ExamTable";

const course = (courseNumber, shortName) => ({
  id: courseNumber,
  courseNumber,
  shortName,
});

// The MSW fixture puts 3,200 and 7,850 in the same 18.01.2027 09:15 slot,
// 3,140 (BYOD) on 05.02.2027 and 7,421's oral block from 30.01.2027.
const MICRO = course("3,200,1.00", "Microeconomics II");
const MICRO_EXERCISES = course("3,200,2.01", "Microeconomics II Exercises");
const MACRO_TITLE =
  "Advanced Macroeconomics II: Asset Prices, Fluctuations and Unemployment";
const MACRO = course("7,850,1.00", MACRO_TITLE);
const OPS = course("3,140,1.00", "Operations Management");
const PRIVACY = course("7,421,1.00", "Data Protection Law");
const UNLISTED = course("9,999,1.00", "Not in the plan");

const READY = { status: "ready", plan: mockData.examSchedule };

const renderTable = ({ courses, planState = READY, onOpenCourse = vi.fn() }) =>
  render(
    <RecoilRoot
      initializeState={({ set }) => {
        set(unifiedCourseDataState, {
          semesters: {
            HS26: {
              cisId: "1",
              available: courses,
              selectedIds: courses.map((c) => c.courseNumber),
            },
          },
          selectedSemester: "HS26",
          latestValidTerm: "HS26",
        });
        set(examPlanState("HS26"), planState);
      }}
    >
      <ExamTable semester="HS26" onOpenCourse={onOpenCourse} />
    </RecoilRoot>,
  );

/** The body rows, each as its cells' text. */
const bodyRows = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );

const rowOf = (text) => screen.getByText(text).closest('[role="row"]');

describe("ExamTable", () => {
  it("warns first that the dates are extracted, naming the plan", () => {
    renderTable({ courses: [MICRO] });

    const note = screen.getByRole("note");
    expect(note).toHaveClass("bg-amber-50");
    expect(note).toHaveTextContent(
      "Automatically extracted — verify before relying on it",
    );
    expect(note).toHaveTextContent(
      "central exam plan (Winter 2027 plan, published 18.08.2026)",
    );
    expect(
      note.compareDocumentPosition(screen.getByRole("table")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("lists one row per exam in date and time order", () => {
    renderTable({ courses: [OPS, PRIVACY, MICRO, MACRO] });

    expect(
      screen.getAllByRole("columnheader").map((th) => th.textContent),
    ).toEqual(["Date", "Time", "Course", "BYOD", "Clash"]);
    expect(bodyRows().map(([date, time, name]) => [date, time, name])).toEqual([
      ["Mon 18.01.2027", "09:15 · 90 min", "Microeconomics II"],
      ["Mon 18.01.2027", "09:15 · 120 min", MACRO_TITLE],
      [
        "Sat 30.01. – Sat 06.02.2027",
        "Oral — individual time in Compass",
        "Data Protection Law",
      ],
      ["Fri 05.02.2027", "09:15 · 90 min", "Operations Management"],
    ]);
  });

  it("names the other course of a clashing pair in red", () => {
    renderTable({ courses: [MICRO, MACRO, OPS] });

    const clash = within(rowOf("Microeconomics II")).getByText(
      `Exam clash with: ${MACRO_TITLE}`,
    );
    expect(clash).toHaveClass("text-danger");
    expect(
      within(rowOf(MACRO_TITLE)).getByText(
        "Exam clash with: Microeconomics II",
      ),
    ).toBeInTheDocument();
    expect(
      within(rowOf("Operations Management")).queryByText(/clash/),
    ).not.toBeInTheDocument();
  });

  it("badges only the BYOD exam", () => {
    renderTable({ courses: [MICRO, OPS] });

    expect(screen.getAllByText("digital (BYOD)")).toHaveLength(1);
    expect(
      within(rowOf("Operations Management")).getByText("digital (BYOD)"),
    ).toHaveClass("bg-hsg-100");
  });

  it("gives a lecture and its exercise group one row", () => {
    renderTable({ courses: [MICRO, MICRO_EXERCISES] });

    expect(bodyRows()).toEqual([
      ["Mon 18.01.2027", "09:15 · 90 min", "Microeconomics II", "", ""],
    ]);
  });

  it("opens a course's details from its name", () => {
    const onOpenCourse = vi.fn();
    renderTable({ courses: [MICRO], onOpenCourse });

    fireEvent.click(screen.getByText("Microeconomics II"));
    expect(onOpenCourse).toHaveBeenCalledWith(expect.objectContaining(MICRO));
  });

  it.each([
    ["the plan loads", [MICRO], { status: "loading", plan: null }],
    ["there is no plan", [MICRO], { status: "none", plan: null }],
    ["the plan failed", [MICRO], { status: "error", plan: null }],
    ["the plan lists none of my courses", [UNLISTED], READY],
  ])("renders nothing while %s", (_, courses, planState) => {
    const { container } = renderTable({ courses, planState });

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});
