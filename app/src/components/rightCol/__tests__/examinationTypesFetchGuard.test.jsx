/**
 * The ExaminationTypes list is a static lookup table. react-tabs unmounts the
 * Course Details panel whenever another tab is selected, so without a guard the
 * list is refetched on every visit. The atom that caches it is the guard.
 */

import { render } from "@testing-library/react";
import { Suspense } from "react";
import { RecoilRoot } from "recoil";
import { describe, expect, it, vi } from "vitest";
import { apiClient } from "../../helpers/axiosClient";
import { authTokenState } from "../../recoil/authAtom";
import { examinationTypesState } from "../../recoil/examinationTypesAtom";
import CourseInfo from "../CourseInfo";

const examCallsOf = (spy) =>
  spy.mock.calls.filter(([url]) => String(url).includes("ExaminationTypes"));

const renderCourseInfo = (initializeState) =>
  render(
    <RecoilRoot initializeState={initializeState}>
      <Suspense fallback={null}>
        <CourseInfo />
      </Suspense>
    </RecoilRoot>,
  );

describe("ExaminationTypes fetch guard", () => {
  // Requests are left pending so no state update lands after the assertion.
  const spyOnGet = () =>
    vi.spyOn(apiClient, "get").mockReturnValue(new Promise(() => {}));

  it("does not refetch when the atom is already populated", () => {
    const getSpy = spyOnGet();

    renderCourseInfo(({ set }) => {
      set(authTokenState, "token");
      set(examinationTypesState, { 1: { shortName: "MC", description: "x" } });
    });

    expect(examCallsOf(getSpy)).toHaveLength(0);
    getSpy.mockRestore();
  });

  it("still fetches once when the atom is at its empty default", () => {
    const getSpy = spyOnGet();

    // examinationTypesState defaults to null, so the guard must treat both null
    // and an empty object as "not loaded yet".
    renderCourseInfo(({ set }) => set(authTokenState, "token"));

    expect(examCallsOf(getSpy)).toHaveLength(1);
    getSpy.mockRestore();
  });
});
