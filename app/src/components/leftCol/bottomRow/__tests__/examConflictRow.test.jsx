/**
 * The course list is where a clash has to be visible while the user is still
 * choosing. A planned course whose central exam overlaps another planned
 * course's says it clashes; a course the user is only browsing says it would
 * clash if added. A course whose exam overlaps nothing planned says nothing.
 *
 * The icons are found by role and name — the way assistive technology finds
 * them — since the clash names are only in the icon's label and tooltip.
 *
 * Nothing is seeded for the exam plan: the list's own read loads it (MSW
 * serves the fixture), which is the path production takes.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { RecoilRoot } from "recoil";
import { describe, expect, it, vi } from "vitest";
import { mockData } from "../../../../test/mocks/handlers";
import { server } from "../../../../test/mocks/server";
import { authTokenState } from "../../../recoil/authAtom";
import { unifiedCourseDataState } from "../../../recoil/unifiedCourseDataAtom";
import EventListContainer from "../EventListContainer";

// AutoSizer measures to 0x0 in jsdom, which would render no rows at all.
vi.mock("react-virtualized-auto-sizer", () => ({
  default: ({ children }) => children({ height: 600, width: 400 }),
}));

// The data manager only coordinates fetching; the seeded atom is the fixture.
vi.mock("../../../helpers/useEventListDataManager", () => ({
  useEventListDataManager: () => ({ isLoading: false }),
  default: () => ({ isLoading: false }),
}));

const SEMESTER = "HS26";

// The MSW exam fixture puts 3,200 and 7,850 in the same 18.01.2027 09:15 slot;
// 3,140 sits a different date entirely.
const MICRO = {
  id: "micro",
  courseNumber: "3,200,1.00",
  shortName: "Microeconomics II",
  classification: "Core",
  credits: 400,
};
// Shares the lecture's root, so it sits the lecture's exam.
const MICRO_EXERCISE = {
  id: "micro-exercise",
  courseNumber: "3,200,2.04",
  shortName: "Microeconomics II: Exercises",
  classification: "Core",
  credits: 0,
};
const CAUSAL = {
  id: "causal",
  courseNumber: "7,850,1.00",
  shortName: "Causal Inference",
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

const TERM_LIST = [
  {
    cisId: "cis-hs26",
    id: "hs26",
    shortName: SEMESTER,
    isCurrent: true,
    isProjected: false,
  },
];

const CATALOG = [MICRO, MICRO_EXERCISE, CAUSAL, OPS];

const renderList = ({ selectedIds = [] } = {}) =>
  render(
    <RecoilRoot
      initializeState={({ set }) => {
        set(authTokenState, "test-token");
        set(unifiedCourseDataState, {
          semesters: {
            [SEMESTER]: {
              enrolledIds: [],
              available: CATALOG,
              selectedIds,
              filtered: CATALOG,
              studyPlan: [],
              ratings: {},
              cisId: "cis-hs26",
              isCurrent: true,
              isProjected: false,
            },
          },
          selectedSemester: SEMESTER,
          latestValidTerm: SEMESTER,
          selectedCourseInfo: null,
        });
      }}
    >
      <EventListContainer
        termListObject={TERM_LIST}
        selectedSemesterShortName={SEMESTER}
      />
    </RecoilRoot>,
  );

const rowOf = (shortName) =>
  screen.getByText(shortName).closest("[data-testid='course-list-row']");

/**
 * Waits for the plan to load and returns the row's clash icon. The row is
 * looked up afresh on every try: the list remounts its rows on each render.
 */
const findClashIcon = (shortName, name) =>
  waitFor(() => within(rowOf(shortName)).getByRole("img", { name }));

const queryClashIcon = (shortName) =>
  within(rowOf(shortName)).queryByRole("img", { name: /^Exam/ });

const BOTH = [MICRO.courseNumber, CAUSAL.courseNumber];

describe("exam conflicts in the course list", () => {
  it("marks both rows of a planned clashing pair and names the other course", async () => {
    renderList({ selectedIds: BOTH });

    const micro = await findClashIcon(
      "Microeconomics II",
      "Exam clash with: Causal Inference. Indicative — verify officially.",
    );
    // The tooltip says what the label says.
    expect(micro).toHaveAttribute(
      "data-tooltip-content",
      "Exam clash with: Causal Inference. Indicative — verify officially.",
    );
    expect(micro).toHaveClass("text-danger");
    expect(
      await findClashIcon(
        "Causal Inference",
        "Exam clash with: Microeconomics II. Indicative — verify officially.",
      ),
    ).toBeInTheDocument();
  });

  it("leaves a course whose exam is on another date alone", async () => {
    renderList({ selectedIds: [...BOTH, OPS.courseNumber] });

    await findClashIcon("Microeconomics II", /^Exam clash with/);
    expect(queryClashIcon("Operations Management")).not.toBeInTheDocument();
  });

  it("warns a browsed course that it would clash with a planned one", async () => {
    renderList({ selectedIds: [MICRO.courseNumber] });

    const causal = await findClashIcon(
      "Causal Inference",
      "Exam would clash with: Microeconomics II. Indicative — verify officially.",
    );
    // Same icon and red as a real clash; only the wording differs.
    expect(causal).toHaveClass("text-danger");
    expect(causal).toHaveAttribute(
      "data-tooltip-content",
      "Exam would clash with: Microeconomics II. Indicative — verify officially.",
    );
    // The planned course competes with nothing planned yet.
    expect(queryClashIcon("Microeconomics II")).not.toBeInTheDocument();
    expect(queryClashIcon("Operations Management")).not.toBeInTheDocument();
  });

  it("reads an exercise group of a planned lecture as planned", async () => {
    renderList({ selectedIds: BOTH });

    // Its exam is the lecture's, which the user already sits.
    expect(
      await findClashIcon(
        "Microeconomics II: Exercises",
        "Exam clash with: Causal Inference. Indicative — verify officially.",
      ),
    ).toBeInTheDocument();
  });

  it("names a course once however many of its exams clash with it", async () => {
    const secondSitting = (root) => ({
      ...mockData.examSchedule.written[0],
      id: `OT-2027-02-10-0915-${root}`,
      date: "2027-02-10",
      startIso: "2027-02-10T09:15:00+01:00",
      rootNumbers: [root],
    });
    server.use(
      http.get("*/exams/HS26.json", () =>
        HttpResponse.json({
          ...mockData.examSchedule,
          written: [
            ...mockData.examSchedule.written,
            secondSitting("3,200"),
            secondSitting("7,850"),
          ],
        }),
      ),
    );
    renderList({ selectedIds: BOTH });

    expect(
      await findClashIcon(
        "Microeconomics II",
        "Exam clash with: Causal Inference. Indicative — verify officially.",
      ),
    ).toBeInTheDocument();
  });
});
