/**
 * Every state of the exam block is a fail-open decision: when we do not have
 * trustworthy dates for a course the panel says nothing rather than guessing.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { RecoilRoot } from "recoil";
import { afterEach, describe, expect, it, vi } from "vitest";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import ExamSchedule from "../ExamSchedule";

const CENTRAL = { isCentral: true, isDeCentral: false, description: "Central" };
const DECENTRAL = {
  isCentral: false,
  isDeCentral: true,
  description: "Decentral",
};

const courseNumbered = (courseNumber, achievementFormStatus = CENTRAL) => ({
  courseNumber,
  achievementFormStatus,
});

const renderSchedule = (
  course,
  { semester = "HS26", metadata = {}, myCourses = [] } = {},
) =>
  render(
    <RecoilRoot
      initializeState={({ set }) =>
        set(unifiedCourseDataState, {
          semesters: {
            [semester]: {
              cisId: "1",
              available: myCourses,
              selectedIds: myCourses.map((c) => c.courseNumber),
              ...metadata,
            },
          },
          selectedSemester: semester,
          latestValidTerm: semester,
          selectedCourseInfo: course,
        })
      }
    >
      <ExamSchedule course={course} semester={semester} />
    </RecoilRoot>,
  );

describe("ExamSchedule", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows weekday, date, slot and duration for a written exam", async () => {
    renderSchedule(courseNumbered("3,200,1.00"));

    expect(await screen.findByText("Mon 18.01.2027")).toBeInTheDocument();
    expect(screen.getByText("09:15")).toBeInTheDocument();
    expect(screen.getByText("90 min")).toBeInTheDocument();
  });

  it("credits the artifact it read and calls the dates indicative", async () => {
    renderSchedule(courseNumbered("3,200,1.00"));

    const footnote = await screen.findByText(/Central exam schedule Winter 2027/);
    expect(footnote).toHaveTextContent("published 18.08.2026");
    expect(footnote).toHaveTextContent(
      "indicative only, always verify against the official exam schedule",
    );
  });

  it("lists the ordinary date before the alternative one and labels it", async () => {
    renderSchedule(courseNumbered("3,802,1.00"));

    await screen.findByText("Tue 26.01.2027");
    const dates = screen.getAllByText(/^Tue \d{2}\.01\.2027$/);
    expect(dates.map((node) => node.textContent)).toEqual([
      "Tue 26.01.2027",
      "Tue 19.01.2027",
    ]);
    expect(screen.getByText("Alternative date")).toBeInTheDocument();
  });

  it("badges a digital exam only when the plan says so", async () => {
    const { unmount } = renderSchedule(courseNumbered("3,140,1.00"));
    expect(await screen.findByText("digital (BYOD)")).toBeInTheDocument();
    unmount();

    renderSchedule(courseNumbered("3,200,1.00"));
    await screen.findByText("Mon 18.01.2027");
    expect(screen.queryByText("digital (BYOD)")).not.toBeInTheDocument();
  });

  it("points oral exams at Compass instead of inventing a time", async () => {
    renderSchedule(courseNumbered("7,421,1.00"));

    expect(await screen.findByText("Sat 30.01.2027")).toBeInTheDocument();
    expect(
      screen.getByText("Oral exam — individual time published in Compass"),
    ).toBeInTheDocument();
  });

  it("says a decentral-only course is the lecturer's to schedule", () => {
    // Course number 3,200 is in the plan; being decentral-only outranks it.
    renderSchedule(courseNumbered("3,200,1.00", DECENTRAL));

    expect(
      screen.getByText("Decentral exam — scheduled by the lecturer."),
    ).toBeInTheDocument();
  });

  it("states plainly when a central course is not in the plan", async () => {
    renderSchedule(courseNumbered("9,999,1.00"));

    expect(
      await screen.findByText("Not in the central exam schedule."),
    ).toBeInTheDocument();
  });

  it("renders nothing for a semester that was never ingested", async () => {
    const { container } = renderSchedule(courseNumbered("3,200,1.00"), {
      semester: "FS26",
    });

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("survives a course without achievementFormStatus", async () => {
    renderSchedule({ courseNumber: "9,999,1.00" });

    expect(
      await screen.findByText("Not in the central exam schedule."),
    ).toBeInTheDocument();
  });

  // The fixture puts 3,200 and 7,850 in the same 18.01.2027 09:15 slot.
  const MICRO = { courseNumber: "3,200,1.00", shortName: "Microeconomics II" };
  const CAUSAL = { courseNumber: "7,850,1.00", shortName: "Causal Inference" };

  it("names the other exam on the row that clashes", async () => {
    renderSchedule(courseNumbered("3,200,1.00"), {
      myCourses: [MICRO, CAUSAL],
    });

    expect(
      await screen.findByText("Overlaps with Causal Inference"),
    ).toBeInTheDocument();
  });

  it("marks the clashing date only, not every date of the course", async () => {
    // 3,802 sits 26.01 (OT) and 19.01 (AT); neither shares 3,200's slot.
    renderSchedule(courseNumbered("3,802,1.00"), {
      myCourses: [MICRO, CAUSAL, { courseNumber: "3,802,1.00", shortName: "German C1" }],
    });

    await screen.findByText("Tue 26.01.2027");
    expect(screen.queryByText(/Overlaps with/)).not.toBeInTheDocument();
  });

  it("never shows exam dates for borrowed catalog data", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    for (const metadata of [
      { isFutureSemester: true, referenceSemester: "HS25" },
      { usingReferenceData: true, referenceSemester: "HS25" },
    ]) {
      const { container, unmount } = renderSchedule(
        courseNumbered("3,200,1.00"),
        { metadata },
      );
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
