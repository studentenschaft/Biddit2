// Every university-API request must go through apiClient, so it gets the
// timeout, retry with backoff, 401 refresh and offline detection.

import { Suspense } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { RecoilRoot } from "recoil";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authTokenState } from "../../recoil/authAtom";
import { termListState } from "../../recoil/termListState";
import { apiClient } from "../axiosClient";
import { catalogUrl, myCoursesUrl, termsUrl } from "../apiEndpoints";
import { useCourseInfoData } from "../useCourseInfoData";
import { useCurriculumMapCourseLoader } from "../useCurriculumMapCourseLoader";
import { useEnrolledCoursesData } from "../useEnrolledCoursesData";
import { useTermSelection } from "../useTermSelection";
import { useUnifiedCourseLoader } from "../useUnifiedCourseLoader";

const TERM = { id: "term-1", cisId: "cis-1", shortName: "HS25" };

// Suspense: useTermSelection reads selectors that suspend once the list loads.
const wrapperWith = (seed) => {
  const wrapper = ({ children }) => (
    <RecoilRoot initializeState={seed}>
      <Suspense fallback={null}>{children}</Suspense>
    </RecoilRoot>
  );
  return wrapper;
};

const plainWrapper = wrapperWith(() => {});

const withLanguage = (language) =>
  expect.objectContaining({
    headers: expect.objectContaining({ "X-RequestedLanguage": language }),
  });

let getSpy;

beforeEach(() => {
  getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({ data: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useEnrolledCoursesData", () => {
  it("fetches enrolments through apiClient", async () => {
    renderHook(
      () => useEnrolledCoursesData({ authToken: "t", selectedSemester: TERM }),
      { wrapper: plainWrapper }
    );
    await waitFor(() =>
      expect(getSpy).toHaveBeenCalledWith(
        myCoursesUrl("term-1"),
        "t",
        withLanguage("EN")
      )
    );
  });
});

describe("useCourseInfoData", () => {
  it("fetches the catalog through apiClient", async () => {
    renderHook(
      () => useCourseInfoData({ authToken: "t", selectedSemester: TERM }),
      { wrapper: plainWrapper }
    );
    await waitFor(() =>
      expect(getSpy).toHaveBeenCalledWith(
        catalogUrl("cis-1"),
        "t",
        withLanguage("EN")
      )
    );
  });
});

describe("useTermSelection", () => {
  it("fetches the term list through apiClient", async () => {
    renderHook(() => useTermSelection(), {
      wrapper: wrapperWith(({ set }) => set(authTokenState, "t")),
    });
    await waitFor(() =>
      expect(getSpy).toHaveBeenCalledWith(termsUrl(), "t", withLanguage("DE"))
    );
  });
});

describe("useCurriculumMapCourseLoader", () => {
  it("fetches missing catalogs through apiClient", async () => {
    renderHook(() => useCurriculumMapCourseLoader("t", ["HS25"]), {
      wrapper: wrapperWith(({ set }) => set(termListState, [TERM])),
    });
    await waitFor(() =>
      expect(getSpy).toHaveBeenCalledWith(
        catalogUrl("cis-1"),
        "t",
        withLanguage("EN")
      )
    );
  });
});

describe("useUnifiedCourseLoader", () => {
  it("fetches catalogs for semesters with selections through apiClient", async () => {
    const unifiedCourseData = {
      semesters: { HS25: { selectedIds: ["7,035,1.00"], available: [] } },
    };
    renderHook(() => useUnifiedCourseLoader("t", unifiedCourseData), {
      wrapper: wrapperWith(({ set }) => set(termListState, [TERM])),
    });
    await waitFor(() =>
      expect(getSpy).toHaveBeenCalledWith(
        catalogUrl("cis-1"),
        "t",
        withLanguage("EN")
      )
    );
  });
});
