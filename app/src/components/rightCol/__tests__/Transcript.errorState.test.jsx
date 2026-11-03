// A failed scorecard load must replace the loading state with the error copy,
// not leave the Transcript on "Loading transcript data..." indefinitely.

import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { RecoilRoot } from "recoil";
import { describe, expect, it, vi } from "vitest";
import Transcript from "../Transcript";
import { authTokenState } from "../../recoil/authAtom";
import { scorecardDataState } from "../../recoil/scorecardsAllRawAtom";

// The seeded failure is the state under test; no new attempt may replace it.
vi.mock("../../helpers/useInitializeScorecards", () => ({
  useInitializeScoreCards: vi.fn(),
}));
vi.mock("../../helpers/useUnifiedCourseLoader", () => ({
  useUnifiedCourseLoader: () => ({ totalSemestersNeeded: 0 }),
}));

describe("Transcript error state", () => {
  it("shows the scorecard error instead of the loading state", async () => {
    render(
      <RecoilRoot
        initializeState={({ set }) => {
          set(authTokenState, "test-token");
          set(scorecardDataState, {
            rawScorecards: {},
            loading: false,
            isLoaded: false,
            error: "BIA: 500",
            lastFetched: null,
          });
        }}
      >
        {/* Transcript reads cisIdListSelector, an async selector. */}
        <Suspense fallback={null}>
          <Transcript />
        </Suspense>
      </RecoilRoot>
    );

    expect(
      await screen.findByText(/couldn.t load your scorecard data/i)
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading transcript data...")).toBeNull();
  });
});
