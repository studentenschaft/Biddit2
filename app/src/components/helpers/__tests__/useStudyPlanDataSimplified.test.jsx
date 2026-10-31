/**
 * useStudyPlanDataSimplified.test.jsx
 *
 * Regression coverage for Finding 1: the fetch effect's degraded-mode
 * fast-path reads a render-captured `isDegradedMode`, but the axios request
 * interceptor reads the live service state. If the kill switch flips ON
 * between render and the in-flight `apiClient.get` call, the request rejects
 * with a DegradedModeError that lands in the hook's catch block - which must
 * not wipe study-plan/unified state (that would erase a wishlist loaded
 * before the incident and stamp `lastFetched` fresh via
 * `touchLastFetched: true`, suppressing the automatic recovery refetch).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { RecoilRoot } from "recoil";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import { apiClient } from "../axiosClient";
import { DegradedModeError } from "../degradedModeService";
import { useUnifiedCourseData } from "../useUnifiedCourseData";
import { useStudyPlanDataSimplified } from "../useStudyPlanDataSimplified";

const selectedSemester = {
  id: "term-1",
  cisId: "cis-1",
  shortName: "HS25",
  isCurrent: true,
  isProjected: false,
};

const PRE_INCIDENT_TIMESTAMP = "2020-01-01T00:00:00.000Z";

const seedWishlist = (set) => {
  set(unifiedCourseDataState, {
    semesters: {
      HS25: {
        enrolledIds: [],
        available: [],
        selectedIds: ["existing-course"],
        filtered: [],
        studyPlan: ["existing-course"],
        ratings: {},
        lastFetched: PRE_INCIDENT_TIMESTAMP,
        isFutureSemester: false,
        referenceSemester: null,
        usingReferenceData: false,
        cisId: "cis-1",
        isCurrent: true,
        isProjected: false,
      },
    },
    selectedSemester: null,
    latestValidTerm: null,
    selectedCourseInfo: null,
  });
};

const buildWrapper = (seed) => {
  const wrapper = ({ children }) => (
    <RecoilRoot initializeState={({ set }) => seed(set)}>
      {children}
    </RecoilRoot>
  );
  return wrapper;
};

// Combines the hook under test with a read of the resulting unified course
// data, so a single renderHook can assert both the loading flag and that
// pre-existing wishlist state survived.
const useHarness = () => {
  const studyPlan = useStudyPlanDataSimplified({
    authToken: "test-token",
    selectedSemester,
  });
  const { getSemesterData } = useUnifiedCourseData();
  return { ...studyPlan, semesterData: getSemesterData("HS25") };
};

describe("useStudyPlanDataSimplified - degraded mode race", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("in-flight DegradedModeError does not wipe the wishlist or stamp lastFetched, and loading resolves", async () => {
    // Simulates the kill switch flipping ON between render (where the
    // hook's captured isDegradedMode was still false, so the fast-path
    // didn't trigger) and this request landing.
    vi.spyOn(apiClient, "get").mockRejectedValueOnce(
      new DegradedModeError("SHSG API disabled (degraded mode)"),
    );

    const { result } = renderHook(() => useHarness(), {
      wrapper: buildWrapper(seedWishlist),
    });

    await waitFor(() => expect(result.current.isStudyPlanLoading).toBe(false));

    // Wishlist loaded before the incident must survive untouched.
    expect(result.current.semesterData.selectedIds).toEqual([
      "existing-course",
    ]);
    expect(result.current.semesterData.studyPlan).toEqual([
      "existing-course",
    ]);
    // lastFetched must not be stamped fresh - that would suppress the
    // automatic recovery refetch once degraded mode clears.
    expect(result.current.semesterData.lastFetched).toBe(
      PRE_INCIDENT_TIMESTAMP,
    );
  });
});
