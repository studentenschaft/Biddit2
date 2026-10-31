// The regression this pins: courses saved during the Bachelor (HS22) showed up
// inside Master scorecard categories, wearing the name and ECTS of whatever
// today's catalogue holds under the same id. Only saved courses from the
// current programme's era belong in its transcript.

import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { RecoilRoot } from "recoil";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Transcript from "../Transcript";
import { authTokenState } from "../../recoil/authAtom";
import { unifiedAcademicDataState } from "../../recoil/unifiedAcademicDataAtom";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";

vi.mock("../../helpers/analytics", () => ({ trackWishlistCleared: vi.fn() }));
vi.mock("../../helpers/useInitializeScorecards", () => ({
  useInitializeScoreCards: vi.fn(),
}));
vi.mock("../../helpers/useScorecardFetching", () => ({
  useScorecardFetching: () => ({ fetchAll: vi.fn() }),
}));
vi.mock("../../helpers/useUnifiedCourseLoader", () => ({
  useUnifiedCourseLoader: () => ({ totalSemestersNeeded: 0 }),
}));

const CATEGORY = {
  isTitle: true,
  isDetail: false,
  hierarchy: "1|1",
  hierarchyParent: "1",
  hierarchyLevel: 2,
  description: "Contextual Studies",
  shortName: "Contextual Studies",
  minCredits: "8.00",
  maxCredits: "12.00",
  items: [],
};

const masterScorecard = (semesters) => ({
  items: [
    {
      isTitle: true,
      hierarchy: "1",
      hierarchyLevel: 1,
      description: "Master in Business Administration",
      minCredits: "0.00",
      maxCredits: "90.00",
      sumOfCredits: "30.00",
      items: [
        {
          ...CATEGORY,
          items: semesters.map((semester, index) => ({
            isTitle: false,
            isDetail: true,
            id: `done-${index}`,
            hierarchy: `1|1|${index}`,
            hierarchyParent: "1|1",
            hierarchyLevel: 3,
            description: `Completed ${semester}`,
            shortName: `Completed ${semester}`,
            semester,
            sumOfCredits: "4.00",
            gradeText: "pass",
            mark: "5.00",
          })),
        },
      ],
    },
  ],
});

// Today's catalogue. Both ids resolve here — that is exactly what let a
// Bachelor-era id borrow a Master course's name and credits.
const CATALOGUE = [
  {
    id: "7,015,1.00",
    courseNumber: "7,015,1.00",
    shortName: "Managerial Impact Project",
    credits: 400,
    classification: "Contextual Studies",
  },
  {
    id: "8,404,1.00",
    courseNumber: "8,404,1.00",
    shortName: "Negotiation Lab",
    credits: 400,
    classification: "Contextual Studies",
  },
];

const renderTranscript = () =>
  render(
    <RecoilRoot
      initializeState={({ set }) => {
        set(authTokenState, "test-token");
        set(unifiedAcademicDataState, {
          currentProgram: "Master in Business Administration",
          programs: {
            "Master in Business Administration": {
              transcript: { rawScorecard: masterScorecard(["HS 25"]) },
              studyPlan: { semesterMap: {} },
              metadata: { isMainStudy: true },
            },
          },
          initialization: { isLoading: false, isInitialized: true, error: null },
        });
        set(unifiedCourseDataState, {
          semesters: {
            // Saved during the Bachelor, long before the Master began.
            HS22: { selectedIds: ["7,015,1.00"], available: [] },
            HS26: {
              selectedIds: ["8,404,1.00"],
              available: CATALOGUE,
              isCurrent: true,
            },
          },
          selectedSemester: "HS26",
          latestValidTerm: "HS26",
          selectedCourseInfo: null,
        });
      }}
    >
      {/* Transcript reads cisIdListSelector, an async selector. */}
      <Suspense fallback={null}>
        <Transcript />
      </Suspense>
    </RecoilRoot>
  );

describe("Transcript - saved courses from an earlier programme", () => {
  beforeEach(() => vi.clearAllMocks());

  it("merges only saved courses from the current programme's era", async () => {
    renderTranscript();

    expect(await screen.findByText("Negotiation Lab")).toBeInTheDocument();
    expect(screen.queryByText("Managerial Impact Project")).toBeNull();
    expect(screen.queryByText("7,015,1.00")).toBeNull();
  });
});
