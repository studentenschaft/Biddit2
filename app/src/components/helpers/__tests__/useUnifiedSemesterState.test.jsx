// setSelectedSemester must seed semesters with the unified schema keys.

import { act, renderHook } from "@testing-library/react";
import { RecoilRoot, useRecoilValue } from "recoil";
import { describe, expect, it } from "vitest";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import { useUnifiedSemesterState } from "../useUnifiedSemesterState";

const wrapper = ({ children }) => <RecoilRoot>{children}</RecoilRoot>;

const termIdList = [
  { shortName: "HS25" },
  { shortName: "HS26" },
  { shortName: "HS27" },
];

const renderSemesterState = () =>
  renderHook(
    () => ({
      api: useUnifiedSemesterState(),
      state: useRecoilValue(unifiedCourseDataState),
    }),
    { wrapper }
  );

describe("useUnifiedSemesterState", () => {
  it("setSelectedSemester seeds a new semester with the unified schema keys", () => {
    const { result } = renderSemesterState();

    act(() => result.current.api.setSelectedSemester("HS27", termIdList, "HS25"));

    const sem = result.current.state.semesters.HS27;
    expect(sem).toHaveProperty("enrolledIds");
    expect(sem).toHaveProperty("selectedIds");
    expect(sem).not.toHaveProperty("enrolled");
    expect(sem).not.toHaveProperty("selected");
    expect(sem.isFutureSemester).toBe(true);
    expect(sem.referenceSemester).toBe("HS26");
  });

  it("keeps ids already stored for the semester", () => {
    const seeded = ({ children }) => (
      <RecoilRoot
        initializeState={({ set }) =>
          set(unifiedCourseDataState, (prev) => ({
            ...prev,
            semesters: {
              HS25: { enrolledIds: ["7,035,1.00"], selectedIds: ["11,702,1.00"] },
            },
          }))
        }
      >
        {children}
      </RecoilRoot>
    );
    const { result } = renderHook(
      () => ({
        api: useUnifiedSemesterState(),
        state: useRecoilValue(unifiedCourseDataState),
      }),
      { wrapper: seeded }
    );

    act(() => result.current.api.setSelectedSemester("HS25", termIdList, "HS25"));

    const sem = result.current.state.semesters.HS25;
    expect(sem.enrolledIds).toEqual(["7,035,1.00"]);
    expect(sem.selectedIds).toEqual(["11,702,1.00"]);
    expect(sem.isFutureSemester).toBe(false);
    expect(sem.referenceSemester).toBeNull();
  });
});
