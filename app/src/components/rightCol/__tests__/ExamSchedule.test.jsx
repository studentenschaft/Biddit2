/**
 * Every state of the exam block says what we actually know: dates when a
 * ready plan lists the course; "decentral" for a decentral-only course it
 * does not list, whatever state the plan is in, as that is the course's own
 * fact; otherwise a plain reason from a ready plan, a reload hint for a
 * failed one, and nothing while there is no plan to judge by.
 */

import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { RecoilRoot } from "recoil";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockData } from "../../../test/mocks/handlers";
import { server } from "../../../test/mocks/server";
import { examPlanState } from "../../recoil/examScheduleAtom";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import ExamSchedule from "../ExamSchedule";

const CENTRAL = { isCentral: true, isDeCentral: false, description: "Central" };
const DECENTRAL = {
  isCentral: false,
  isDeCentral: true,
  description: "Decentral",
};

const FOOTNOTE =
  "Winter 2027 plan, published 18.08.2026. Extracted automatically from " +
  "the official PDF — indicative only, always verify against the official " +
  "exam schedule.";

const DECENTRAL_MESSAGE = "Decentral exam — scheduled by the lecturer.";
const LOAD_FAILED = "Exam dates could not be loaded — reload to retry.";

const NOT_FOUND =
  "Central exam date not found in the extracted schedule — check the " +
  "official exam plan.";

const courseNumbered = (courseNumber, achievementFormStatus = CENTRAL) => ({
  courseNumber,
  achievementFormStatus,
});

/**
 * The plan comes from the MSW handler unless `planState` seeds the atom,
 * which pins a state the fetch cannot reach on its own.
 */
const renderSchedule = (
  course,
  { semester = "HS26", metadata = {}, myCourses = [], planState } = {},
) =>
  render(
    <RecoilRoot
      initializeState={({ set }) => {
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
        });
        if (planState) set(examPlanState(semester), planState);
      }}
    >
      <ExamSchedule course={course} semester={semester} />
    </RecoilRoot>,
  );

// The fixture plan with extra written exams appended.
const servePlanWith = (...written) =>
  server.use(
    http.get("*/exams/HS26.json", () =>
      HttpResponse.json({
        ...mockData.examSchedule,
        written: [...mockData.examSchedule.written, ...written],
      }),
    ),
  );

describe("ExamSchedule", () => {
  afterEach(() => vi.restoreAllMocks());

  describe("for a course the plan lists", () => {
    it("shows weekday, date, slot and exam facts for a written exam", async () => {
      renderSchedule(courseNumbered("3,200,1.00"));

      expect(await screen.findByText("Mon 18.01.2027")).toBeInTheDocument();
      expect(screen.getByText("09:15")).toBeInTheDocument();
      expect(screen.getByText("Exam · 90 min")).toBeInTheDocument();
    });

    it("credits the artifact it read and calls the dates indicative", async () => {
      renderSchedule(courseNumbered("3,200,1.00"));

      expect(await screen.findByText(FOOTNOTE)).toBeInTheDocument();
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
      expect(await screen.findByText("digital (BYOD)")).toHaveClass(
        "bg-hsg-100",
      );
      // Said once, by the badge, not again in the exam facts.
      expect(screen.getByText("Exam · 90 min")).toBeInTheDocument();
      unmount();

      renderSchedule(courseNumbered("3,200,1.00"));
      await screen.findByText("Mon 18.01.2027");
      expect(screen.queryByText(/BYOD/)).not.toBeInTheDocument();
    });

    it("shows an oral exam's date range and points at Compass for the day", async () => {
      renderSchedule(courseNumbered("7,421,1.00"));

      expect(
        await screen.findByText("Sat 30.01. – Sat 06.02.2027"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Oral exam — individual time published in Compass"),
      ).toBeInTheDocument();
      expect(screen.getByText(FOOTNOTE)).toBeInTheDocument();
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

    it("trusts the plan over a decentral flag", async () => {
      renderSchedule(courseNumbered("3,200,1.00", DECENTRAL));

      expect(await screen.findByText("Mon 18.01.2027")).toBeInTheDocument();
      expect(screen.queryByText(DECENTRAL_MESSAGE)).not.toBeInTheDocument();
    });
  });

  describe("for a course the plan does not list", () => {
    it.each([
      ["a ready plan", { status: "ready", plan: mockData.examSchedule }],
      ["a loading plan", { status: "loading", plan: null }],
      ["no plan", { status: "none", plan: null }],
      ["a failed plan", { status: "error", plan: null }],
    ])(
      "says a decentral-only course is the lecturer's to schedule, with %s",
      async (_, planState) => {
        renderSchedule(courseNumbered("9,999,1.00", DECENTRAL), { planState });

        expect(await screen.findByText(DECENTRAL_MESSAGE)).toBeInTheDocument();
        expect(screen.queryByText(LOAD_FAILED)).not.toBeInTheDocument();
        expect(screen.queryByText(FOOTNOTE)).not.toBeInTheDocument();
      },
    );

    it.each([
      ["a central course", courseNumbered("9,999,1.00")],
      [
        "a central and decentral course",
        courseNumbered("9,999,1.00", { ...CENTRAL, isDeCentral: true }),
      ],
      ["a course it cannot key", { courseNumber: "TBA" }],
    ])("sends %s to the official plan", async (_, course) => {
      renderSchedule(course);

      expect(await screen.findByText(NOT_FOUND)).toBeInTheDocument();
      expect(screen.getByText(FOOTNOTE)).toBeInTheDocument();
    });

    it.each([
      [
        "neither central nor decentral",
        courseNumbered("9,999,1.00", { ...CENTRAL, isCentral: false }),
      ],
      ["without achievementFormStatus", { courseNumber: "9,999,1.00" }],
    ])("says a course %s is not in the schedule", async (_, course) => {
      renderSchedule(course);

      expect(
        await screen.findByText("Not in the central exam schedule."),
      ).toBeInTheDocument();
      expect(screen.queryByText(FOOTNOTE)).not.toBeInTheDocument();
    });
  });

  describe("without a ready plan", () => {
    it("says the dates could not be loaded when the plan failed", () => {
      renderSchedule(courseNumbered("3,200,1.00"), {
        planState: { status: "error", plan: null },
      });

      expect(screen.getByText(LOAD_FAILED)).toBeInTheDocument();
      expect(screen.queryByText(FOOTNOTE)).not.toBeInTheDocument();
    });

    it.each([
      ["while the plan loads", { status: "loading", plan: null }],
      ["for a semester that was never ingested", { status: "none", plan: null }],
    ])("renders nothing for a central course %s", (_, planState) => {
      const { container } = renderSchedule(courseNumbered("3,200,1.00"), {
        planState,
      });

      expect(container).toBeEmptyDOMElement();
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

  describe("clashes", () => {
    // The fixture puts 3,200 and 7,850 in the same 18.01.2027 09:15 slot.
    const MICRO = { courseNumber: "3,200,1.00", shortName: "Microeconomics II" };
    const CAUSAL = { courseNumber: "7,850,1.00", shortName: "Causal Inference" };

    it("names the other exam on the row that clashes", async () => {
      renderSchedule(courseNumbered("3,200,1.00"), {
        myCourses: [MICRO, CAUSAL],
      });

      expect(
        await screen.findByText("Exam clash with: Causal Inference"),
      ).toBeInTheDocument();
    });

    it("marks the clashing date only, not every date of the course", async () => {
      // Give 3,200 a second written exam that clashes with nothing.
      const [micro] = mockData.examSchedule.written;
      servePlanWith({
        ...micro,
        id: "OT-2027-02-01-1515-3,200",
        date: "2027-02-01",
        slot: "15:15",
        startIso: "2027-02-01T15:15:00+01:00",
      });
      renderSchedule(courseNumbered("3,200,1.00"), {
        myCourses: [MICRO, CAUSAL],
      });

      const warning = await screen.findByText(
        "Exam clash with: Causal Inference",
      );
      expect(warning.parentElement).toHaveTextContent("Mon 18.01.2027");
      expect(screen.getByText("Mon 01.02.2027")).toBeInTheDocument();
      expect(screen.getAllByText(/clash with/)).toHaveLength(1);
    });

    it("warns a browsed course that it would clash with a planned one", async () => {
      // Microeconomics is only browsed; Causal Inference is planned.
      renderSchedule(courseNumbered("3,200,1.00"), { myCourses: [CAUSAL] });

      expect(
        await screen.findByText("Exam would clash with: Causal Inference"),
      ).toBeInTheDocument();
    });

    it("calls the clash real for the second listing of a cross-listed exam", async () => {
      // Both listings of Deutsch C1 (26.01.2027 09:15) are planned, and the
      // plan's exam is named after the first. Give Microeconomics a second
      // exam in the same slot.
      const [micro] = mockData.examSchedule.written;
      servePlanWith({
        ...micro,
        id: "OT-2027-01-26-0915-3,200",
        date: "2027-01-26",
        startIso: "2027-01-26T09:15:00+01:00",
      });
      renderSchedule(courseNumbered("4,802,1.00"), {
        myCourses: [
          { courseNumber: "3,802,1.00", shortName: "German C1 (BA)" },
          { courseNumber: "4,802,1.00", shortName: "German C1 (MA)" },
          MICRO,
        ],
      });

      expect(
        await screen.findByText("Exam clash with: Microeconomics II"),
      ).toBeInTheDocument();
    });
  });
});
