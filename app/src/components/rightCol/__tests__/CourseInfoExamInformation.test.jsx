/**
 * The "Exam Information" part of Course Details as the panel wires it: which
 * semester the exam dates are judged on, and the exam lines that come from
 * the course itself.
 *
 * A projected semester (HS27) reuses its reference semester's cisId, so the
 * course's semester found by reverse cisId lookup can be HS26 while the
 * student is looking at HS27 — whose catalog is borrowed from HS26.
 */

import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { RecoilRoot } from "recoil";
import { describe, expect, it } from "vitest";
import { mockData } from "../../../test/mocks/handlers";
import { examPlanState } from "../../recoil/examScheduleAtom";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import CourseInfo from "../CourseInfo";

const HS26_CIS_ID = "cis-hs26";

// 3,200 sits on Mon 18.01.2027 in the fixture plan.
const MICRO = {
  shortName: "Microeconomics II",
  courseNumber: "3,200,1.00",
  semesterId: HS26_CIS_ID,
  credits: 400,
  classification: "Core",
  achievementFormStatus: {
    isCentral: true,
    isDeCentral: false,
    description: "Written exam",
  },
};

const renderCourseInfo = (course, selectedSemester = "HS26") =>
  render(
    <RecoilRoot
      initializeState={({ set }) => {
        set(unifiedCourseDataState, {
          semesters: {
            HS26: { cisId: HS26_CIS_ID, available: [course] },
            HS27: {
              cisId: HS26_CIS_ID,
              isProjected: true,
              isFutureSemester: true,
              referenceSemester: "HS26",
              available: [course],
            },
          },
          selectedSemester,
          latestValidTerm: "HS26",
          selectedCourseInfo: course,
        });
        set(examPlanState("HS26"), {
          status: "ready",
          plan: mockData.examSchedule,
        });
      }}
    >
      <Suspense fallback={null}>
        <CourseInfo />
      </Suspense>
    </RecoilRoot>,
  );

describe("CourseInfo exam information", () => {
  it("shows the exam dates of the semester on screen", async () => {
    renderCourseInfo(MICRO, "HS26");

    expect(await screen.findByText("Mon 18.01.2027")).toBeInTheDocument();
  });

  it("shows no exam dates for a projected semester that borrows the course", async () => {
    renderCourseInfo(MICRO, "HS27");

    await screen.findByText("Exam Information");
    expect(screen.queryByText("Mon 18.01.2027")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Central exam schedule/),
    ).not.toBeInTheDocument();
  });

  it("does not call a missing course sheet missing exam information", async () => {
    // No auth token, so the course sheet is never fetched: the fallback sits
    // right under the exam date and must not contradict it.
    renderCourseInfo(MICRO);

    await screen.findByText("Mon 18.01.2027");
    expect(screen.getByText("No exam breakdown available")).toBeInTheDocument();
    expect(screen.queryByText("No Exam Information")).not.toBeInTheDocument();
  });

  it.each([
    {
      status: { isCentral: true, isDeCentral: true, description: "Paper" },
      label: "| Central & Decentral (Paper)",
    },
    {
      status: { isCentral: true, isDeCentral: false, description: "Paper" },
      label: "| Central (Paper)",
    },
    {
      status: { isCentral: false, isDeCentral: true, description: "Paper" },
      label: "| Decentral (Paper)",
    },
  ])("shows $label in the header", async ({ status, label }) => {
    renderCourseInfo({ ...MICRO, achievementFormStatus: status });

    expect(await screen.findByText(/ECTS/)).toHaveTextContent(label);
  });

  it("renders a course that carries no achievementFormStatus", async () => {
    renderCourseInfo({ ...MICRO, achievementFormStatus: undefined });

    const header = await screen.findByText(/ECTS/);
    expect(header).toHaveTextContent("4.00 ECTS | Core");
    expect(header).not.toHaveTextContent(/Central|Decentral/);
    expect(screen.getByText("Mon 18.01.2027")).toBeInTheDocument();
  });
});
