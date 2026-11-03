// Setter-only hosts must neither re-render on atom changes nor receive new
// function identities on every render (which would re-fire their effects).

import { act, renderHook } from "@testing-library/react";
import { RecoilRoot, useRecoilValue } from "recoil";
import { describe, expect, it } from "vitest";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import { useUnifiedCourseDataWriters } from "../useUnifiedCourseDataWriters";

const wrapper = ({ children }) => <RecoilRoot>{children}</RecoilRoot>;

describe("useUnifiedCourseDataWriters", () => {
  it("returns the same function identities across renders", () => {
    const { result, rerender } = renderHook(
      () => useUnifiedCourseDataWriters(),
      { wrapper }
    );
    const first = result.current;
    rerender();
    expect(result.current.updateSelectedCourses).toBe(
      first.updateSelectedCourses
    );
    Object.keys(first).forEach((name) => {
      expect(result.current[name], name).toBe(first[name]);
    });
  });

  it("does not re-render its host when the atom changes", () => {
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders++;
        return useUnifiedCourseDataWriters();
      },
      { wrapper }
    );
    act(() => result.current.updateSelectedCourses("HS25", ["7,035,1.00"]));
    expect(renders).toBe(1);
  });

  it("writes to the unified course data atom", () => {
    const { result } = renderHook(
      () => ({
        writers: useUnifiedCourseDataWriters(),
        state: useRecoilValue(unifiedCourseDataState),
      }),
      { wrapper }
    );
    act(() =>
      result.current.writers.updateSelectedCourses("HS25", ["7,035,1.00"])
    );
    expect(result.current.state.semesters.HS25.selectedIds).toEqual([
      "7,035,1.00",
    ]);
  });

  it("filters only semesters that exist, using the latest state", () => {
    const { result } = renderHook(
      () => ({
        writers: useUnifiedCourseDataWriters(),
        state: useRecoilValue(unifiedCourseDataState),
      }),
      { wrapper }
    );
    act(() => {
      result.current.writers.updateFilteredCourses("FS26", {});
    });
    expect(result.current.state.semesters.FS26).toBeUndefined();

    act(() => {
      result.current.writers.updateAvailableCourses("HS25", [
        { id: "a", courseNumber: "7,035,1.00", shortName: "A", credits: 400 },
      ]);
      result.current.writers.updateFilteredCourses("HS25", {});
    });
    expect(result.current.state.semesters.HS25.filtered).toHaveLength(1);
  });
});
