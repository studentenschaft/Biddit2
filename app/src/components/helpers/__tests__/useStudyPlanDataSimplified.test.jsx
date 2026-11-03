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
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { RecoilRoot, useRecoilValue } from "recoil";
import {
  server,
  setErrorMode,
  ErrorSimulation,
} from "../../../test/mocks/server";
import { errorHandlingService } from "../../errorHandling/ErrorHandlingService";
import { useInvalidateStudyPlan } from "../../recoil/studyPlanLoadState";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import { apiClient } from "../axiosClient";
import { SHSG_API } from "../apiEndpoints";
import { DegradedModeError } from "../degradedModeService";
import { useCourseSelection } from "../useCourseSelection";
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
        studyPlan: ["existing-course"],
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

describe("useStudyPlanDataSimplified - once per session", () => {
  const HS25 = { id: "term-hs25", cisId: "cis-hs25", shortName: "HS25" };
  const FS26 = { id: "term-fs26", cisId: "cis-fs26", shortName: "FS26" };
  const wrapper = ({ children }) => <RecoilRoot>{children}</RecoilRoot>;

  const countStudyPlanFetches = () => {
    const counter = { hits: 0 };
    server.use(
      http.get(`${SHSG_API}/study-plans`, () => {
        counter.hits++;
        return HttpResponse.json({ HS25: ["7,035,1.00"], FS26: [] });
      })
    );
    return counter;
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches /study-plans once across two semester switches", async () => {
    const counter = countStudyPlanFetches();

    const { rerender } = renderHook(
      ({ sem }) =>
        useStudyPlanDataSimplified({ authToken: "t", selectedSemester: sem }),
      { wrapper, initialProps: { sem: HS25 } }
    );
    await waitFor(() => expect(counter.hits).toBe(1));

    rerender({ sem: FS26 });
    rerender({ sem: HS25 });
    await new Promise((r) => setTimeout(r, 50));

    expect(counter.hits).toBe(1);
  });

  it("retries on a semester switch while nothing has loaded", async () => {
    let hits = 0;
    server.use(
      http.get(`${SHSG_API}/study-plans`, () => {
        hits++;
        return hits === 1
          ? HttpResponse.json({ message: "boom" }, { status: 500 })
          : HttpResponse.json({ HS25: ["7,035,1.00"], FS26: [] });
      })
    );
    // A 500 is retried with a multi-second backoff; fail the retry at once.
    vi.spyOn(apiClient, "retryWithBackoff").mockImplementation((error) =>
      Promise.reject(error)
    );
    vi.spyOn(errorHandlingService, "handleError").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { result, rerender } = renderHook(
      ({ sem }) => {
        const { isStudyPlanLoading } = useStudyPlanDataSimplified({
          authToken: "t",
          selectedSemester: sem,
        });
        return {
          isStudyPlanLoading,
          state: useRecoilValue(unifiedCourseDataState),
        };
      },
      { wrapper, initialProps: { sem: HS25 } }
    );
    await waitFor(() => expect(result.current.isStudyPlanLoading).toBe(false));
    expect(hits).toBe(1);

    rerender({ sem: FS26 });

    await waitFor(() =>
      expect(result.current.state.semesters.HS25?.selectedIds).toEqual([
        "7,035,1.00",
      ])
    );
    expect(hits).toBe(2);
  });

  it("refetches after the study plan is invalidated", async () => {
    const counter = countStudyPlanFetches();

    const { result } = renderHook(
      () => {
        const { isStudyPlanLoading } = useStudyPlanDataSimplified({
          authToken: "t",
          selectedSemester: HS25,
        });
        return { isStudyPlanLoading, invalidate: useInvalidateStudyPlan() };
      },
      { wrapper }
    );
    await waitFor(() => expect(counter.hits).toBe(1));

    act(() => result.current.invalidate());

    await waitFor(() => expect(counter.hits).toBe(2));
  });

  it("re-syncs from the server after a failed wishlist write", async () => {
    const counter = countStudyPlanFetches();
    vi.spyOn(errorHandlingService, "handleError").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(
      () => {
        useStudyPlanDataSimplified({ authToken: "t", selectedSemester: HS25 });
        return useCourseSelection({
          selectedCourseIds: [],
          selectedSemesterShortName: "HS25",
          authToken: "t",
        });
      },
      { wrapper }
    );
    await waitFor(() => expect(counter.hits).toBe(1));

    setErrorMode(ErrorSimulation.FORBIDDEN_403, "/study-plans/HS25/");
    await act(async () => {
      await result.current.addOrRemoveCourse({
        id: "course-1",
        courseNumber: "7,214,1.00",
        semester: "HS25",
      });
    });

    await waitFor(() => expect(counter.hits).toBe(2));
  });

  it("does not refetch after a successful wishlist write", async () => {
    const counter = countStudyPlanFetches();

    const { result } = renderHook(
      () => {
        useStudyPlanDataSimplified({ authToken: "t", selectedSemester: HS25 });
        return useCourseSelection({
          selectedCourseIds: [],
          selectedSemesterShortName: "HS25",
          authToken: "t",
        });
      },
      { wrapper }
    );
    await waitFor(() => expect(counter.hits).toBe(1));

    await act(async () => {
      await result.current.addOrRemoveCourse({
        id: "course-1",
        courseNumber: "7,214,1.00",
        semester: "HS25",
      });
    });
    await new Promise((r) => setTimeout(r, 50));

    expect(counter.hits).toBe(1);
  });
});
