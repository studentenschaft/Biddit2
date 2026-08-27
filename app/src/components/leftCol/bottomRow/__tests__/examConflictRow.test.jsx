/**
 * The course list is where a clash has to be visible while the user is still
 * choosing. The row warns only when the course is in the user's own plan and
 * its central exam shares a date and slot with another planned course — a row
 * that merely sits in the catalog says nothing.
 *
 * The list is also the surface that mounts `useExamSchedule`: the selector only
 * reads the atom, so a container that forgot the hook would render no warnings
 * at all and this test would catch it.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import { RecoilRoot } from "recoil";
import { describe, expect, it, vi } from "vitest";
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

const CATALOG = [MICRO, CAUSAL, OPS];

const renderList = ({ selectedIds = [], metadata = {} } = {}) =>
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
              ...metadata,
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
  screen.getByText(shortName).closest("div.flex.w-full");

const BOTH = [MICRO.courseNumber, CAUSAL.courseNumber];

describe("exam conflicts in the course list", () => {
  it("marks both rows of a clashing pair and names the other course", async () => {
    renderList({ selectedIds: BOTH });

    await waitFor(() =>
      expect(screen.getAllByLabelText("Exam overlap")).toHaveLength(2),
    );

    expect(
      within(rowOf("Microeconomics II")).getByLabelText("Exam overlap"),
    ).toHaveAttribute(
      "data-tooltip-content",
      "Exam overlaps with: Causal Inference. Indicative — verify officially.",
    );
    expect(
      within(rowOf("Causal Inference")).getByLabelText("Exam overlap"),
    ).toHaveAttribute(
      "data-tooltip-content",
      "Exam overlaps with: Microeconomics II. Indicative — verify officially.",
    );
  });

  it("leaves a course whose exam is on another date alone", async () => {
    renderList({ selectedIds: [...BOTH, OPS.courseNumber] });

    await waitFor(() =>
      expect(screen.getAllByLabelText("Exam overlap")).toHaveLength(2),
    );
    expect(
      within(rowOf("Operations Management")).queryByLabelText("Exam overlap"),
    ).not.toBeInTheDocument();
  });

});
