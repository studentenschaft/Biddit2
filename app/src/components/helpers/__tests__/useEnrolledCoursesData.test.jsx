// The enrolment effect ignores the result of a run that was superseded (a
// semester switch, or React StrictMode running the effect twice in dev).

import { StrictMode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { RecoilRoot, useRecoilValue } from "recoil";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../test/mocks/server";
import { errorHandlingService } from "../../errorHandling/ErrorHandlingService";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import { myCoursesUrl } from "../apiEndpoints";
import { useEnrolledCoursesData } from "../useEnrolledCoursesData";

const seedSemesters = ({ set }) =>
  set(unifiedCourseDataState, {
    semesters: {
      HS25: { enrolledIds: [], available: [], selectedIds: [] },
      FS26: { enrolledIds: [], available: [], selectedIds: [] },
    },
    ratings: {},
    selectedSemester: "HS25",
    latestValidTerm: "HS25",
    selectedCourseInfo: null,
  });

const wrapper = ({ children }) => (
  <RecoilRoot initializeState={seedSemesters}>{children}</RecoilRoot>
);

const StrictModeWrapper = ({ children }) => (
  <StrictMode>
    <RecoilRoot initializeState={seedSemesters}>{children}</RecoilRoot>
  </StrictMode>
);

const useHarness = ({ sem }) => {
  const enrolment = useEnrolledCoursesData({
    authToken: "t",
    selectedSemester: sem,
  });
  return { ...enrolment, state: useRecoilValue(unifiedCourseDataState) };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useEnrolledCoursesData", () => {
  it("ignores the result of a superseded fetch", async () => {
    server.use(
      http.get(myCoursesUrl("term-1"), async () => {
        await delay(50);
        return HttpResponse.json([{ id: "old" }]);
      }),
      http.get(myCoursesUrl("term-2"), () => HttpResponse.json([{ id: "new" }]))
    );

    const { result, rerender } = renderHook(useHarness, {
      wrapper,
      initialProps: { sem: { id: "term-1", shortName: "HS25" } },
    });
    const readSemester = (key) => result.current.state.semesters[key];

    rerender({ sem: { id: "term-2", shortName: "FS26" } });

    await waitFor(() =>
      expect(readSemester("FS26").enrolledIds).toEqual(["new"])
    );
    await new Promise((r) => setTimeout(r, 80));
    expect(readSemester("HS25").enrolledIds).toEqual([]); // the stale response was dropped
    expect(result.current.isEnrolledCoursesLoading).toBe(false);
  });

  it("reports a failed fetch once", async () => {
    server.use(
      http.get(myCoursesUrl("term-1"), () => new HttpResponse(null, { status: 404 }))
    );
    const spy = vi
      .spyOn(errorHandlingService, "handleError")
      .mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(useHarness, {
      wrapper: StrictModeWrapper,
      initialProps: { sem: { id: "term-1", shortName: "HS25" } },
    });

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(result.current.isEnrolledCoursesLoading).toBe(false)
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
