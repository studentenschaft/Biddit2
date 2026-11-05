// Pins the startup term selection: calendar term first, the API's isCurrent
// flag as fallback, and projected semesters appended after the API terms.

import { Suspense } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { RecoilRoot, useRecoilValue } from "recoil";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../test/mocks/server";
import { authTokenState } from "../../recoil/authAtom";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import { myCoursesUrl, termsUrl } from "../apiEndpoints";
import { useTermSelection } from "../useTermSelection";

const term = (shortName, isCurrent = false) => ({
  shortName,
  id: `cis-${shortName}`,
  timeSegmentId: `ts-${shortName}`,
  isCurrent,
});

const THREE_TERMS = [term("FS26"), term("HS26", true), term("FS27")];

const wrapper = ({ children }) => (
  <RecoilRoot initializeState={({ set }) => set(authTokenState, "t")}>
    <Suspense fallback={null}>{children}</Suspense>
  </RecoilRoot>
);

let myCoursesHits;

const renderTermSelection = (terms) => {
  myCoursesHits = 0;
  server.use(
    http.get(termsUrl(), () => HttpResponse.json(terms)),
    http.get(myCoursesUrl("*"), () => {
      myCoursesHits++;
      return HttpResponse.json([]);
    })
  );
  return renderHook(
    () => ({
      selection: useTermSelection(),
      state: useRecoilValue(unifiedCourseDataState),
    }),
    { wrapper }
  );
};

const waitForTermList = (result) =>
  waitFor(() => {
    expect(result.current).not.toBeNull();
    expect(result.current.selection.isLoading).toBe(false);
    expect(result.current.selection.termListObject.length).toBeGreaterThan(0);
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useTermSelection", () => {
  it("projects semesters until two follow the current term", async () => {
    const { result } = renderTermSelection(THREE_TERMS);
    await waitForTermList(result);

    // FS27 comes from the API, so only HS27 is projected.
    expect(
      result.current.selection.termListObject.map((t) => t.shortName)
    ).toEqual(["FS26", "HS26", "FS27", "HS27"]);
  });

  it("projects two semesters when the API has none after the current term", async () => {
    const { result } = renderTermSelection([term("FS26"), term("HS26", true)]);
    await waitForTermList(result);

    expect(
      result.current.selection.termListObject.map((t) => t.shortName)
    ).toEqual(["FS26", "HS26", "FS27", "HS27"]);
    expect(
      result.current.selection.termListObject
        .filter((t) => t.isProjected)
        .map((t) => t.shortName)
    ).toEqual(["FS27", "HS27"]);
  });

  it("links a projected semester to its same-season previous-year reference", async () => {
    const { result } = renderTermSelection(THREE_TERMS);
    await waitForTermList(result);

    const { termListObject } = result.current.selection;
    const hs26 = termListObject.find((t) => t.shortName === "HS26");
    const hs27 = termListObject.find((t) => t.shortName === "HS27");
    expect(hs27).toMatchObject({
      isProjected: true,
      referenceSemester: "HS26",
      referenceCisId: hs26.cisId,
    });
  });

  it("selects the calendar term as the selected and latest valid term", async () => {
    const { result } = renderTermSelection(THREE_TERMS);
    await waitFor(() =>
      expect(result.current?.state.selectedSemester).toBe("HS26")
    );
    expect(result.current.state.latestValidTerm).toBe("HS26");
  });

  it("leaves the enrolment request to useEnrolledCoursesData", async () => {
    const { result } = renderTermSelection(THREE_TERMS);
    await waitFor(() =>
      expect(result.current?.state.latestValidTerm).toBe("HS26")
    );
    await waitForTermList(result);

    expect(myCoursesHits).toBe(0);
  });

  it("falls back to the API's isCurrent term when the calendar term is missing", async () => {
    const { result } = renderTermSelection([term("FS25"), term("HS25", true)]);
    await waitFor(() =>
      expect(result.current?.state.selectedSemester).toBe("HS25")
    );
  });
});
