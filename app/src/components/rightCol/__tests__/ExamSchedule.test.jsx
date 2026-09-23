/**
 * Every state of the exam block is a fail-open decision: when we do not have
 * trustworthy dates for a course the panel says nothing rather than guessing.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { RecoilRoot } from "recoil";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockData } from "../../../test/mocks/handlers";
import { server } from "../../../test/mocks/server";
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

  it("shows the ordinary date and never the plan's alternative one", async () => {
    // The fixture's AT row for 3,802 (19.01) is another term's alternative
    // date, as every AT row in this PDF is.
    renderSchedule(courseNumbered("3,802,1.00"));

    expect(await screen.findByText("Tue 26.01.2027")).toBeInTheDocument();
    expect(screen.queryByText("Tue 19.01.2027")).not.toBeInTheDocument();
  });

  it("badges a digital exam only when the plan says so", async () => {
    const { unmount } = renderSchedule(courseNumbered("3,140,1.00"));
    expect(await screen.findByText("digital (BYOD)")).toBeInTheDocument();
    unmount();

    renderSchedule(courseNumbered("3,200,1.00"));
    await screen.findByText("Mon 18.01.2027");
    expect(screen.queryByText("digital (BYOD)")).not.toBeInTheDocument();
  });

  it("shows an oral exam's date range and points at Compass for the day", async () => {
    renderSchedule(courseNumbered("7,421,1.00"));

    expect(
      await screen.findByText("Sat 30.01. – Sat 06.02.2027"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Oral exam — individual time published in Compass"),
    ).toBeInTheDocument();
  });

  it("shows a one-day oral block as a plain date", async () => {
    const [oral] = mockData.examSchedule.oral;
    server.use(
      http.get("*/exams/HS26.json", () =>
        HttpResponse.json({
          ...mockData.examSchedule,
          oral: [{ ...oral, dateEnd: oral.dateStart }],
        }),
      ),
    );
    renderSchedule(courseNumbered("7,421,1.00"));

    expect(await screen.findByText("Sat 30.01.2027")).toBeInTheDocument();
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
    // Give 3,200 a second written exam that clashes with nothing.
    const [micro] = mockData.examSchedule.written;
    server.use(
      http.get("*/exams/HS26.json", () =>
        HttpResponse.json({
          ...mockData.examSchedule,
          written: [
            ...mockData.examSchedule.written,
            {
              ...micro,
              id: "OT-2027-02-01-1515-3,200",
              date: "2027-02-01",
              slot: "15:15",
              startIso: "2027-02-01T15:15:00+01:00",
            },
          ],
        }),
      ),
    );
    renderSchedule(courseNumbered("3,200,1.00"), {
      myCourses: [MICRO, CAUSAL],
    });

    const warning = await screen.findByText("Overlaps with Causal Inference");
    expect(warning.parentElement).toHaveTextContent("Mon 18.01.2027");
    expect(screen.getByText("Mon 01.02.2027")).toBeInTheDocument();
    expect(screen.getAllByText(/Overlaps with/)).toHaveLength(1);
  });

  it("says nothing about clashes for a course the user has not planned", async () => {
    // Microeconomics is only browsed, so its clash with the planned Causal
    // Inference is not reported here.
    renderSchedule(courseNumbered("3,200,1.00"), { myCourses: [CAUSAL] });

    await screen.findByText("Mon 18.01.2027");
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
