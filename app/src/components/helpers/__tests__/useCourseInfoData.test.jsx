// Pins the catalog load and the reference-semester fallback of the course list
// (see REFERENCE_SEMESTER.md) before the loader is consolidated.

import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { RecoilRoot, useRecoilValue } from "recoil";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../test/mocks/server";
import { errorHandlingService } from "../../errorHandling/ErrorHandlingService";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import { apiClient } from "../axiosClient";
import { catalogUrl } from "../apiEndpoints";
import { useCourseInfoData } from "../useCourseInfoData";

const SEMESTER = {
  cisId: "cis-26",
  shortName: "HS26",
  referenceCisId: "cis-25",
  referenceSemester: "HS25",
};

const courses = (count, prefix) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    courseNumber: `${prefix},${i},1.00`,
    shortName: `${prefix} course ${i}`,
    credits: 400,
  }));

const catalog = (cisId, body) =>
  http.get(catalogUrl(cisId), () => HttpResponse.json(body));
const catalogError = (cisId) =>
  http.get(catalogUrl(cisId), () =>
    HttpResponse.json({ message: "boom" }, { status: 500 })
  );

const wrapper = ({ children }) => <RecoilRoot>{children}</RecoilRoot>;

const renderCourseInfo = (selectedSemester) =>
  renderHook(
    () => ({
      hook: useCourseInfoData({ authToken: "t", selectedSemester }),
      state: useRecoilValue(unifiedCourseDataState),
    }),
    { wrapper }
  );

let handleErrorSpy;

beforeEach(() => {
  handleErrorSpy = vi
    .spyOn(errorHandlingService, "handleError")
    .mockImplementation(() => {});
  // A 500 is retried with a multi-second backoff; fail the retry at once.
  vi.spyOn(apiClient, "retryWithBackoff").mockImplementation((error) =>
    Promise.reject(error)
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useCourseInfoData", () => {
  it("stores a full catalog as the term's own data", async () => {
    server.use(catalog("cis-26", courses(12, "own")));

    const { result } = renderCourseInfo(SEMESTER);

    await waitFor(() =>
      expect(result.current.state.semesters.HS26?.available).toHaveLength(12)
    );
    expect(result.current.state.semesters.HS26.usingReferenceData).toBe(false);
    expect(result.current.hook.isCourseDataLoading).toBe(false);
  });

  it("previews the reference term when the term's catalog is sparse", async () => {
    server.use(
      catalog("cis-26", courses(3, "own")),
      catalog("cis-25", courses(12, "ref"))
    );

    const { result } = renderCourseInfo(SEMESTER);

    await waitFor(() =>
      expect(result.current.state.semesters.HS26?.available).toHaveLength(12)
    );
    const semester = result.current.state.semesters.HS26;
    expect(semester.usingReferenceData).toBe(true);
    expect(semester.referenceSemester).toBe("HS25");
    expect(semester.available[0].courseNumber).toBe("ref,0,1.00");
  });

  it("stores the reference data without an error when the primary returns 500", async () => {
    server.use(catalogError("cis-26"), catalog("cis-25", courses(12, "ref")));

    const { result } = renderCourseInfo(SEMESTER);

    await waitFor(() =>
      expect(result.current.state.semesters.HS26?.available).toHaveLength(12)
    );
    expect(result.current.state.semesters.HS26.usingReferenceData).toBe(true);
    await waitFor(() =>
      expect(result.current.hook.isCourseDataLoading).toBe(false)
    );
    expect(handleErrorSpy).not.toHaveBeenCalled();
  });

  it("reports one error and stops loading when the primary returns 500 and there is no reference", async () => {
    server.use(catalogError("cis-26"));

    const { result } = renderCourseInfo({
      ...SEMESTER,
      referenceCisId: undefined,
    });

    await waitFor(() =>
      expect(result.current.hook.isCourseDataLoading).toBe(false)
    );
    expect(handleErrorSpy).toHaveBeenCalledTimes(1);
    expect(result.current.state.semesters.HS26?.available ?? []).toEqual([]);
  });
});
