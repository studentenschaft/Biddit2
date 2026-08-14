/**
 * The Curriculum Map panel stays mounted across tab switches, so its
 * `fetchAttempted` flag lives for the whole session — a first attempt that
 * fails is never cleared by a remount. Without the retry below the panel would
 * be pinned to its loading skeleton until a full page reload.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { RecoilRoot, selector } from "recoil";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authTokenState } from "../../../recoil/authAtom";
import { curriculumPlansRegistryState } from "../../../recoil/curriculumPlansRegistryAtom";
import CurriculumMap from "../CurriculumMap";

const fetchAll = vi.fn().mockResolvedValue({ success: false });
const scorecardFetching = { fetchAll, isLoaded: false, loading: false, error: null };

vi.mock("../../../recoil/curriculumMapSelector", () => ({
  curriculumMapSelector: selector({
    key: "curriculumMapSelectorTestStub",
    get: () => ({ isLoaded: false, semesters: [], program: null }),
  }),
}));
vi.mock("../../../helpers/useScorecardFetching", () => ({
  useScorecardFetching: () => scorecardFetching,
}));
vi.mock("../../../helpers/useInitializeScorecards", () => ({
  useInitializeScoreCards: () => {},
}));
vi.mock("../../../helpers/useCurriculumMapCourseLoader", () => ({
  useCurriculumMapCourseLoader: () => {},
}));
vi.mock("../../../helpers/usePlanManager", () => ({
  default: () => ({ loadPlans: vi.fn(), importSelectedCourses: vi.fn() }),
}));

const renderMap = () =>
  render(
    <RecoilRoot
      initializeState={({ set }) => {
        set(authTokenState, "token");
        set(curriculumPlansRegistryState, (prev) => ({
          ...prev,
          isLoaded: true,
        }));
      }}
    >
      <CurriculumMap />
    </RecoilRoot>,
  );

describe("CurriculumMap load failure", () => {
  beforeEach(() => {
    fetchAll.mockClear();
    scorecardFetching.error = null;
  });

  it("stays on the skeleton while the first attempt is still in flight", () => {
    renderMap();

    expect(fetchAll).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  it("offers a retry that re-arms the fetch after a failure", () => {
    scorecardFetching.error = "No enrollment information available.";
    renderMap();

    expect(fetchAll).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(fetchAll).toHaveBeenCalledTimes(2);
  });
});
