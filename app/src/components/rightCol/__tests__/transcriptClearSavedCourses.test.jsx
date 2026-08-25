// The regression this pins: "Clear All Saved Courses" told every user their
// wishlist was empty. A failure and an empty wishlist must never look alike.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { RecoilRoot } from "recoil";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Transcript from "../Transcript";
import { authTokenState } from "../../recoil/authAtom";
import { unifiedAcademicDataState } from "../../recoil/unifiedAcademicDataAtom";
import { clearSavedCourses } from "../../helpers/clearSavedCourses";

vi.mock("../../helpers/clearSavedCourses", async (importOriginal) => ({
  ...(await importOriginal()),
  clearSavedCourses: vi.fn(),
}));
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

const SCORECARD = {
  items: [
    {
      isTitle: true,
      hierarchy: "1",
      hierarchyLevel: 1,
      description: "Master",
      sumOfCredits: "90.00",
      items: [],
    },
  ],
};

const clickClear = async () => {
  render(
    <RecoilRoot
      initializeState={({ set }) => {
        set(authTokenState, "test-token");
        set(unifiedAcademicDataState, {
          currentProgram: "Master",
          programs: {
            Master: {
              transcript: { rawScorecard: SCORECARD },
              metadata: { isMainStudy: true },
            },
          },
          initialization: { isLoading: false, isInitialized: true, error: null },
        });
      }}
    >
      {/* Transcript reads cisIdListSelector, an async selector. */}
      <Suspense fallback={null}>
        <Transcript />
      </Suspense>
    </RecoilRoot>
  );

  fireEvent.click(
    await screen.findByRole("button", { name: "Clear All Saved Courses" })
  );
};

describe("Transcript - Clear All Saved Courses", () => {
  let alertSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("does not report a failed lookup as an empty wishlist", async () => {
    clearSavedCourses.mockRejectedValue(new Error("network down"));

    await clickClear();

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Could not load your saved courses. Please try again."
      )
    );
    expect(alertSpy).not.toHaveBeenCalledWith(
      "No saved courses found to clear."
    );
  });

  it("reports an empty wishlist only when the backend really has none", async () => {
    clearSavedCourses.mockResolvedValue({ total: 0, deleted: 0 });

    await clickClear();

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith("No saved courses found to clear.")
    );
  });

  it("does not announce a clean sweep when only some deletions went through", async () => {
    clearSavedCourses.mockResolvedValue({ total: 5, deleted: 3 });

    await clickClear();

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cleared 3 of 5 saved courses")
      )
    );
  });

  it("leaves the backend alone when the user cancels the confirm", async () => {
    window.confirm.mockReturnValue(false);

    await clickClear();

    expect(clearSavedCourses).not.toHaveBeenCalled();
  });
});
