/**
 * Resilience tests for the degraded-mode kill switch's effect on course
 * loading (see `helpers/degradedModeService.js` and the fast-path fix in
 * `useStudyPlanDataSimplified.js` / `useCourseRatingsData.js`).
 *
 * These exercise the real degradedModeService singleton (via `_fetchStatusOnce`,
 * same pattern as `helpers/__tests__/degradedModeService.test.js`) together with
 * the real hooks and MSW, rather than mocking the service - the point of these
 * tests is to prove the wiring between the service, the hooks, and axiosClient
 * actually holds together end to end.
 */

import { useMemo } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { RecoilRoot } from "recoil";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";
import {
  getDegradedMode,
  _fetchStatusOnce,
  _resetForTests,
} from "../../components/helpers/degradedModeService";
import { apiClient } from "../../components/helpers/axiosClient";
import { useEventListDataManager } from "../../components/helpers/useEventListDataManager";
import { useStudyPlanDataSimplified } from "../../components/helpers/useStudyPlanDataSimplified";
import { useUnifiedCourseData } from "../../components/helpers/useUnifiedCourseData";

const UNISG_API = "https://integration.unisg.ch";
const SHSG_API = "https://api.shsg.ch";

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

const selectedSemester = {
  id: "term-1",
  cisId: "cis-1",
  shortName: "HS25",
  isCurrent: true,
  isProjected: false,
};

const wrapper = ({ children }) => <RecoilRoot>{children}</RecoilRoot>;

// Combines the manager under test with a read of the resulting unified
// course data, so a single renderHook can assert both loading flags and
// that university data actually landed in state.
const useHarness = () => {
  // Real callers pass a Recoil-backed value that's stable across renders
  // (see EventListContainer.jsx); a fresh literal here would retrigger
  // useEventListDataManager's filter effect every render.
  const selectionOptions = useMemo(() => ({}), []);
  const manager = useEventListDataManager(
    selectedSemester,
    selectionOptions,
    "test-token",
  );
  const { getSemesterData } = useUnifiedCourseData();
  return { ...manager, semesterData: getSemesterData(selectedSemester.shortName) };
};

describe("degraded mode resilience", () => {
  beforeEach(() => {
    _resetForTests();
  });

  afterEach(() => {
    _resetForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("flag ON → course list still loads (SHSG-backed hooks fast-path instead of hanging)", async () => {
    // Flip the real degraded-mode service on.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ degradedMode: true, message: "SHSG outage" }),
      ),
    );
    await _fetchStatusOnce();
    expect(getDegradedMode().isDegradedMode).toBe(true);

    // University API responds normally - a non-trivial catalog so the
    // sparse/reference-preview branch is not engaged.
    server.use(
      http.get(
        `${UNISG_API}/EventApi/CourseInformationSheets/*`,
        () =>
          HttpResponse.json([
            { id: "c1", courseNumber: "1,001,1.00", shortName: "Course One" },
          ]),
      ),
    );

    const { result } = renderHook(() => useHarness(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // The SHSG-backed hooks fast-pathed rather than hanging.
    expect(result.current.isStudyPlanLoading).toBe(false);
    expect(result.current.isCourseRatingsLoading).toBe(false);
    // The university-backed hooks were not affected by degraded mode.
    expect(result.current.isEnrolledCoursesLoading).toBe(false);
    expect(result.current.isCourseDataLoading).toBe(false);
    expect(result.current.semesterData.available.length).toBeGreaterThan(0);
  });

  it("flag ON then OFF → auto-refetch (SHSG fetch resumes without remounting)", async () => {
    const studyPlanCalls = vi.fn();
    server.use(
      http.get(`${SHSG_API}/study-plans`, () => {
        studyPlanCalls();
        return HttpResponse.json({});
      }),
    );

    // Start degraded.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ degradedMode: true })),
    );
    await _fetchStatusOnce();
    expect(getDegradedMode().isDegradedMode).toBe(true);

    const { result } = renderHook(
      () =>
        useStudyPlanDataSimplified({
          authToken: "test-token",
          selectedSemester,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isStudyPlanLoading).toBe(false));
    expect(studyPlanCalls).not.toHaveBeenCalled();

    // Flip degraded mode off via the same listener mechanism the app uses
    // (no unmount/remount of the hook in between).
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ degradedMode: false })),
    );
    await act(async () => {
      await _fetchStatusOnce();
    });

    await waitFor(() => expect(studyPlanCalls).toHaveBeenCalledTimes(1));
  });

  it("status JSON unreachable → app behaves normally (fail-open regression)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await _fetchStatusOnce();

    expect(getDegradedMode().isDegradedMode).toBe(false);

    // Fail-open must mean more than an untouched internal flag: SHSG
    // requests through the real axios client must still go through.
    const response = await apiClient.get(
      `${SHSG_API}/study-plans`,
      "test-token",
    );
    expect(response.status).toBe(200);
  });
});
