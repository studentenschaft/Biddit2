// Callers that handle a failure themselves (or stay silent on purpose) opt out
// of apiClient's error toast, so a failure shows at most one toast.

import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../test/mocks/server";
import { errorHandlingService } from "../../errorHandling/ErrorHandlingService";
import { fetchCurrentEnrollments } from "../../recoil/ApiCurrentEnrollments";
import { fetchScoreCardDetails } from "../../recoil/ApiScorecardDetails";
import { deleteCourse, saveCourse } from "../api";
import { apiClient } from "../axiosClient";
import { catalogUrl, SHSG_API, UNISG_API } from "../apiEndpoints";
import { querySimilarCourses, upsertSimilarCourses } from "../similarCoursesApi";

let handleErrorSpy;

beforeEach(() => {
  // 404 is not retryable, so the request fails at once.
  server.use(
    http.get(catalogUrl("cis-1"), () =>
      HttpResponse.json({ message: "not found" }, { status: 404 })
    )
  );
  handleErrorSpy = vi
    .spyOn(errorHandlingService, "handleError")
    .mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiClient suppressErrorToast", () => {
  it("skips the error handler when the request opts out", async () => {
    await expect(
      apiClient.get(catalogUrl("cis-1"), "t", { suppressErrorToast: true })
    ).rejects.toMatchObject({ response: { status: 404 } });
    expect(handleErrorSpy).not.toHaveBeenCalled();
  });

  it("calls the error handler once by default", async () => {
    await expect(apiClient.get(catalogUrl("cis-1"), "t")).rejects.toMatchObject(
      { response: { status: 404 } }
    );
    expect(handleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it("leaves a scorecard failure to the caller, which reports it once", async () => {
    server.use(
      http.get(`${UNISG_API}/AchievementApi/MyScoreCards/detail/*`, () =>
        HttpResponse.json({ message: "not found" }, { status: 404 })
      )
    );

    await expect(fetchScoreCardDetails("t", "reg-1", 1)).rejects.toMatchObject({
      response: { status: 404 },
    });
    expect(handleErrorSpy).not.toHaveBeenCalled();
  });
});

// Callers that report a failure in their own catch must reach the error
// handler exactly once: their own report, never the interceptor's as well.
describe("callers that report their own failures", () => {
  const notFound = () =>
    HttpResponse.json({ message: "not found" }, { status: 404 });

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("saveCourse reports a failed save once", async () => {
    server.use(http.post(`${SHSG_API}/study-plans/:term/:course`, notFound));
    expect(await saveCourse("HS25", "7,035,1.00", "t")).toBe(false);
    expect(handleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it("deleteCourse reports a failed delete once", async () => {
    server.use(http.delete(`${SHSG_API}/study-plans/:term/:course`, notFound));
    expect(await deleteCourse("HS25", "7,035,1.00", "t")).toBe(false);
    expect(handleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it("a bulk deleteCourse (reportErrors: false) leaves reporting to its caller", async () => {
    server.use(http.delete(`${SHSG_API}/study-plans/:term/:course`, notFound));
    expect(
      await deleteCourse("HS25", "7,035,1.00", "t", { reportErrors: false })
    ).toBe(false);
    expect(handleErrorSpy).not.toHaveBeenCalled();
  });

  it("querySimilarCourses leaves a failure to its callers", async () => {
    server.use(http.get(`${SHSG_API}/similar-courses/query`, notFound));
    await expect(
      querySimilarCourses({ authToken: "t", courseDescription: "x", semester: "HS25" })
    ).rejects.toMatchObject({ response: { status: 404 } });
    expect(handleErrorSpy).not.toHaveBeenCalled();
  });

  it("upsertSimilarCourses reports a failed upsert once", async () => {
    server.use(http.post(`${SHSG_API}/similar-courses/upsert`, notFound));
    const result = await upsertSimilarCourses({
      authToken: "t",
      courses: [{ courseNumber: "7,035,1.00" }],
      selectedSemester: "HS25",
      isReferenceData: false,
    });
    expect(result.upserted).toBe(false);
    expect(handleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it("fetchCurrentEnrollments leaves a failure to its caller", async () => {
    server.use(
      http.get(`${UNISG_API}/StudyApi/MyEnrollments/currentEnrollments`, notFound)
    );
    await expect(fetchCurrentEnrollments("t")).rejects.toMatchObject({
      response: { status: 404 },
    });
    expect(handleErrorSpy).not.toHaveBeenCalled();
  });
});
