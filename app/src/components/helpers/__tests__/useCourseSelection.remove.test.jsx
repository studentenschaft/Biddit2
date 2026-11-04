/**
 * Wishlist removal deletes under at most two ids (course number and a legacy
 * catalog id) in parallel, clears the local entry under both, and reports an
 * error only when no delete succeeded. Runs against MSW, not a mocked api.js.
 */

import { act, renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { RecoilRoot, useRecoilValue } from "recoil";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../test/mocks/server";
import { errorHandlingService } from "../../errorHandling/ErrorHandlingService";
import { studyPlanLoadState } from "../../recoil/studyPlanLoadState";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import { useCourseSelection } from "../useCourseSelection";

vi.mock("../analytics", () => ({ trackWishlistChange: vi.fn() }));

const DELETE_URL = "https://api.shsg.ch/study-plans/:termId/:courseId";
const COURSE_NUMBER = "7,035,1.00";
const LEGACY_ID = "evt-123";

/** Records every DELETE and answers with `statusFor(courseId)`. */
const recordDeletes = (statusFor = () => 200) => {
  const deleted = [];
  server.use(
    http.delete(DELETE_URL, ({ params }) => {
      deleted.push(params.courseId);
      const status = statusFor(params.courseId);
      return status === 200
        ? HttpResponse.json({ success: true })
        : new HttpResponse(null, { status });
    }),
  );
  return deleted;
};

const renderRemoval = (selectedIds) =>
  renderHook(
    () => ({
      selection: useCourseSelection({
        selectedCourseIds: selectedIds,
        selectedSemesterShortName: "HS25",
        authToken: "token",
      }),
      courseData: useRecoilValue(unifiedCourseDataState),
      loadState: useRecoilValue(studyPlanLoadState),
    }),
    {
      wrapper: ({ children }) => (
        <RecoilRoot
          initializeState={({ set }) =>
            set(unifiedCourseDataState, (prev) => ({
              ...prev,
              semesters: {
                HS25: { enrolledIds: [], available: [], selectedIds },
              },
            }))
          }
        >
          {children}
        </RecoilRoot>
      ),
    },
  );

const remove = async (result, course) => {
  await act(async () => {
    await result.current.selection.addOrRemoveCourse({
      semester: "HS25",
      ...course,
    });
  });
};

describe("useCourseSelection wishlist removal", () => {
  let handleError;

  beforeEach(() => {
    handleError = vi
      .spyOn(errorHandlingService, "handleError")
      .mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("issues one DELETE when the id is the course number", async () => {
    const deleted = recordDeletes();
    const { result } = renderRemoval([COURSE_NUMBER]);

    await remove(result, { id: COURSE_NUMBER, courseNumber: COURSE_NUMBER });

    expect(deleted).toEqual([COURSE_NUMBER]);
  });

  it("issues two DELETEs in parallel when a legacy id differs", async () => {
    let inFlight = 0;
    let peakInFlight = 0;
    let releaseBoth;
    const bothArrived = new Promise((resolve) => {
      releaseBoth = resolve;
    });
    const deleted = [];
    server.use(
      http.delete(DELETE_URL, async ({ params }) => {
        deleted.push(params.courseId);
        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);
        if (inFlight === 2) releaseBoth();
        // A serial caller never sends the second request; the timeout lets the
        // test fail on the assertion instead of hanging.
        await Promise.race([
          bothArrived,
          new Promise((resolve) => setTimeout(resolve, 1000)),
        ]);
        inFlight -= 1;
        return HttpResponse.json({ success: true });
      }),
    );
    const { result } = renderRemoval([COURSE_NUMBER]);

    await remove(result, { id: LEGACY_ID, courseNumber: COURSE_NUMBER });

    expect(deleted.sort()).toEqual([COURSE_NUMBER, LEGACY_ID].sort());
    expect(peakInFlight).toBe(2);
  });

  it("treats a 404 on the legacy id as success", async () => {
    recordDeletes((id) => (id === LEGACY_ID ? 404 : 200));
    const { result } = renderRemoval([COURSE_NUMBER]);
    const versionBefore = result.current.loadState.version;

    await remove(result, { id: LEGACY_ID, courseNumber: COURSE_NUMBER });

    expect(handleError).not.toHaveBeenCalled();
    expect(result.current.loadState.version).toBe(versionBefore);
  });

  it("reports once and refetches the study plan when every delete fails", async () => {
    recordDeletes((id) => (id === LEGACY_ID ? 404 : 403));
    const { result } = renderRemoval([COURSE_NUMBER]);
    const versionBefore = result.current.loadState.version;

    await remove(result, { id: LEGACY_ID, courseNumber: COURSE_NUMBER });

    expect(handleError).toHaveBeenCalledTimes(1);
    expect(result.current.loadState.version).toBe(versionBefore + 1);
  });

  it("clears a local entry stored under the legacy catalog id", async () => {
    recordDeletes();
    const { result } = renderRemoval([LEGACY_ID]);

    await remove(result, { id: LEGACY_ID, courseNumber: COURSE_NUMBER });

    expect(result.current.courseData.semesters.HS25.selectedIds).toEqual([]);
  });
});
