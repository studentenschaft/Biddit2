// The course list memoizes its rows on these callbacks; a new identity on
// every render would rebuild itemData and re-render every visible row.

import { renderHook } from "@testing-library/react";
import { RecoilRoot } from "recoil";
import { describe, expect, it } from "vitest";
import { useCourseSelection } from "../useCourseSelection";
import { useOpenCourseDetails } from "../useOpenCourseDetails";

const wrapper = ({ children }) => <RecoilRoot>{children}</RecoilRoot>;

const SELECTED_IDS = ["7,214,1.00"];

describe("course list callbacks", () => {
  it("useOpenCourseDetails keeps its identity across renders", () => {
    const { result, rerender } = renderHook(() => useOpenCourseDetails(), {
      wrapper,
    });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("addOrRemoveCourse keeps its identity while its inputs are unchanged", () => {
    const { result, rerender } = renderHook(
      () =>
        useCourseSelection({
          selectedCourseIds: SELECTED_IDS,
          selectedSemesterShortName: "HS25",
          authToken: "token",
        }),
      { wrapper }
    );
    const first = result.current.addOrRemoveCourse;
    rerender();
    expect(result.current.addOrRemoveCourse).toBe(first);
  });
});
