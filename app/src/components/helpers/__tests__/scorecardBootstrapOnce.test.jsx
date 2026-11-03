// Two consumers mounting together (CurriculumMap mounts useInitializeScoreCards
// and calls fetchAll itself) must fetch the scorecards once, not once each.

import { useEffect } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { RecoilRoot, useRecoilValue, useSetRecoilState } from "recoil";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authTokenState } from "../../recoil/authAtom";
import { currentEnrollmentsState } from "../../recoil/currentEnrollmentsAtom";
import { scorecardDataState } from "../../recoil/scorecardsAllRawAtom";
import { unifiedAcademicDataState } from "../../recoil/unifiedAcademicDataAtom";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import { fetchScoreCardDetails } from "../../recoil/ApiScorecardDetails";
import { useInitializeScoreCards } from "../useInitializeScorecards";
import { useScorecardFetching } from "../useScorecardFetching";

const PROGRAM = "Bachelor in Business Administration";
const ENROLLMENTS = {
  enrollmentInfos: [
    {
      studyProgramDescription: PROGRAM,
      studyRegulationId: "reg-1",
      attempt: 1,
      isMainStudy: true,
    },
  ],
};

vi.mock("../../recoil/ApiScorecardDetails", () => ({
  fetchScoreCardDetails: vi.fn(async () => ({
    success: true,
    data: { items: [], creditsFulfilledDe: false, creditsFulfilledEn: false },
  })),
}));

vi.mock("../../recoil/ApiCurrentEnrollments", () => ({
  fetchCurrentEnrollments: vi.fn(async () => ENROLLMENTS),
}));

const wrapper = ({ children }) => (
  <RecoilRoot
    initializeState={({ set }) => {
      set(authTokenState, "t");
      set(currentEnrollmentsState, ENROLLMENTS);
    }}
  >
    {children}
  </RecoilRoot>
);

describe("scorecard bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches scorecards once when both bootstrap paths mount together", async () => {
    const { result } = renderHook(
      () => {
        useInitializeScoreCards(vi.fn());
        const { fetchAll } = useScorecardFetching();
        useEffect(() => {
          fetchAll("t");
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);
        return useRecoilValue(unifiedAcademicDataState);
      },
      { wrapper }
    );

    await waitFor(() => expect(result.current.currentProgram).toBe(PROGRAM));
    expect(fetchScoreCardDetails).toHaveBeenCalledTimes(1);
  });

  it("does not refetch on its own after a failed attempt", async () => {
    fetchScoreCardDetails.mockResolvedValueOnce({ success: false, error: "boom" });
    const { result } = renderHook(
      () => {
        useInitializeScoreCards(vi.fn());
        return {
          scorecards: useRecoilValue(scorecardDataState),
          setCourseData: useSetRecoilState(unifiedCourseDataState),
        };
      },
      { wrapper }
    );
    await waitFor(() => expect(result.current.scorecards.error).toMatch(/boom/));

    // Course data changes all the time and gives fetchAll a new identity.
    act(() =>
      result.current.setCourseData((prev) => ({ ...prev, selectedSemester: "HS25" }))
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

    expect(fetchScoreCardDetails).toHaveBeenCalledTimes(1);
  });
});
