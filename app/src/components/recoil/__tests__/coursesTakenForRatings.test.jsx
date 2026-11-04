/**
 * Covers the degraded-mode console-noise fix in coursesTakenForRatings.js:
 * when the kill switch is ON and a request is in flight, the SHSG call
 * rejects with a DegradedModeError - expected traffic, not a real failure -
 * so the atom's catch block must fall back to [] silently instead of
 * logging via console.error.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { RecoilRoot, useSetRecoilState } from "recoil";
import { useRecoilValue } from "recoil";
import { delay, http, HttpResponse } from "msw";
import { server } from "../../../test/mocks/server";
import { myCoursesUrl, termsUrl } from "../../helpers/apiEndpoints";
import {
  _fetchStatusOnce,
  _resetForTests,
} from "../../helpers/degradedModeService";
import { authTokenState } from "../authAtom";
import { cisIdList } from "../cisIdListAtom";
import { latestValidTermProjectionState } from "../latestValidTermProjection";
import {
  _resetRatingRequestsForTests,
  coursesRatedState,
  coursesTakenForRatingState,
} from "../coursesTakenForRatings";

const wrapper = ({ children }) => <RecoilRoot>{children}</RecoilRoot>;

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

describe("coursesRatedState (degraded mode)", () => {
  beforeEach(() => {
    _resetForTests();
  });

  afterEach(() => {
    _resetForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("resolves to [] without logging via console.error when the kill switch is on", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ degradedMode: true })),
    );
    await _fetchStatusOnce();

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { result } = renderHook(() => useRecoilValue(coursesRatedState), {
      wrapper,
    });

    await waitFor(() => expect(result.current).toEqual([]));

    // Assert on the specific message rather than "not called at all" - an
    // unrelated Recoil/React batching warning also goes through
    // console.error in this test harness and isn't what's under test here.
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      "Error fetching rated courses:",
      expect.anything(),
    );
  });
});

/**
 * One cold start: the term list arrives (cisIdList), the rated-courses request
 * is still pending when the selector first runs, and the projection term lands
 * afterwards. Each of those used to re-run the selector and re-download the
 * term list and every term's MyCourses. The prompt now reads the term list
 * from cisIdList (no request of its own) and MyCourses once per term.
 */
describe("coursesTakenForRatingState (requests per session)", () => {
  // HS26 is current; FS23 to FS26 are ratable (seven terms), HS22 is too old.
  const RATABLE = ["FS26", "HS25", "FS25", "HS24", "FS24", "HS23", "FS23"];
  const TERMS = ["HS26", ...RATABLE, "HS22"].map((shortName) => ({
    shortName,
    timeSegmentId: `ts-${shortName}`,
  }));
  const CIS_ID_LIST = TERMS.map(({ shortName, timeSegmentId }) => ({
    shortName,
    timeSegmentId,
    id: `cis-${shortName}`,
    isCurrent: shortName === "HS26",
  }));

  beforeEach(() => {
    _resetRatingRequestsForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the term list from cisIdList and each term's MyCourses once", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let termHits = 0;
    const myCoursesHits = new Map();
    server.use(
      http.get(termsUrl(), () => {
        termHits++;
        return HttpResponse.json(TERMS);
      }),
      http.get(myCoursesUrl(":termId"), ({ params }) => {
        myCoursesHits.set(
          params.termId,
          (myCoursesHits.get(params.termId) || 0) + 1,
        );
        return HttpResponse.json([
          {
            eventCourseNumber: `course-${params.termId}`,
            eventDescription: `Course of ${params.termId}`,
          },
        ]);
      }),
      http.get("https://api.shsg.ch/course-ratings/of-user", async () => {
        await delay(30);
        return HttpResponse.json(["course-ts-FS26"]);
      }),
    );

    const wrapper = ({ children }) => (
      <RecoilRoot
        initializeState={({ set }) => {
          set(authTokenState, "ratings-cold-start-token");
          set(cisIdList, CIS_ID_LIST);
        }}
      >
        <Suspense fallback={null}>{children}</Suspense>
      </RecoilRoot>
    );

    const { result } = renderHook(
      () => ({
        courses: useRecoilValue(coursesTakenForRatingState),
        setProjection: useSetRecoilState(latestValidTermProjectionState),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current?.courses).toHaveLength(6));

    // The projection term arrives later in the real start-up sequence.
    act(() => result.current.setProjection("HS26"));
    await waitFor(() => expect(result.current?.courses).toHaveLength(6));

    expect(termHits).toBe(0);
    expect([...myCoursesHits.keys()].sort()).toEqual(
      RATABLE.map((term) => `ts-${term}`).sort(),
    );
    expect([...myCoursesHits.values()].every((hits) => hits === 1)).toBe(true);
    expect(result.current.courses.map((course) => course.courseId)).not.toContain(
      "course-ts-FS26",
    );
    expect(errorSpy).not.toHaveBeenCalledWith(
      "Error fetching courses for rating:",
      expect.anything(),
    );
  });
});
