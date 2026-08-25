// patchSemester auto-initializes semesters that arrive from the study-plan API.

import { act, renderHook } from "@testing-library/react";
import { RecoilRoot, useRecoilValue } from "recoil";
import { describe, expect, it } from "vitest";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import { useUnifiedCourseData } from "../useUnifiedCourseData";

const wrapper = ({ children }) => <RecoilRoot>{children}</RecoilRoot>;

const renderUnifiedData = () =>
  renderHook(
    () => ({
      api: useUnifiedCourseData(),
      state: useRecoilValue(unifiedCourseDataState),
    }),
    { wrapper }
  );

describe("patchSemester auto-initialization", () => {
  it("gives a never-seen semester the full structure, not just the patched key", () => {
    const { result } = renderUnifiedData();

    act(() => {
      result.current.api.updateSelectedCourses("FS23", ["7,035,1.00"]);
    });

    const semester = result.current.state.semesters.FS23;

    expect(semester.selectedIds).toEqual(["7,035,1.00"]);
    // The fields the rest of the app reads without guarding must exist.
    expect(semester.enrolledIds).toEqual([]);
    expect(semester.available).toEqual([]);
    expect(semester.filtered).toEqual([]);
    expect(semester.studyPlan).toEqual([]);
    expect(semester).toHaveProperty("referenceSemester", null);
    expect(semester).toHaveProperty("isProjected", false);
  });

  it("keeps unrelated semesters intact", () => {
    const { result } = renderUnifiedData();

    act(() => {
      result.current.api.updateSelectedCourses("FS23", ["7,035,1.00"]);
    });
    act(() => {
      result.current.api.updateSelectedCourses("HS25", ["11,702,1.00"]);
    });

    expect(result.current.state.semesters.FS23.selectedIds).toEqual([
      "7,035,1.00",
    ]);
    expect(result.current.state.semesters.HS25.selectedIds).toEqual([
      "11,702,1.00",
    ]);
  });

  it("patches an existing semester without dropping its other fields", () => {
    const { result } = renderUnifiedData();

    act(() => {
      result.current.api.updateSelectedCourses("FS23", ["7,035,1.00"]);
    });
    act(() => {
      result.current.api.updateStudyPlan("FS23", ["7,035,1.00", "7,214,1.00"]);
    });

    const semester = result.current.state.semesters.FS23;
    expect(semester.selectedIds).toEqual(["7,035,1.00"]);
    expect(semester.studyPlan).toEqual(["7,035,1.00", "7,214,1.00"]);
  });
});
