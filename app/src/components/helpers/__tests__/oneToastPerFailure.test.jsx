// A failed request shows exactly one error toast, counted across the whole
// path: apiClient, the API module, errorHandlingService and the owning hook.

import { act, renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { RecoilRoot } from "recoil";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../test/mocks/server";
import { authTokenState } from "../../recoil/authAtom";
import { curriculumPlansRegistryState } from "../../recoil/curriculumPlansRegistryAtom";
import { SHSG_API, UNISG_API } from "../apiEndpoints";
import usePlanManager from "../usePlanManager";
import { useScorecardFetching } from "../useScorecardFetching";

const { mockToast } = vi.hoisted(() => ({
  mockToast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("react-toastify", () => ({ toast: mockToast }));

// 404 is not retryable, so the request fails at once.
const notFound = () =>
  HttpResponse.json({ message: "not found" }, { status: 404 });

const wrapper = ({ children }) => (
  <RecoilRoot
    initializeState={({ set }) => {
      set(authTokenState, "t");
      set(curriculumPlansRegistryState, (prev) => ({
        ...prev,
        activePlanId: "plan-default",
      }));
    }}
  >
    {children}
  </RecoilRoot>
);

beforeEach(() => {
  mockToast.error.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("one toast per failure", () => {
  it("a failed curriculum-plan action toasts once, from usePlanManager", async () => {
    server.use(
      http.post(`${SHSG_API}/curriculum-plans/:planId/:placementId`, notFound)
    );
    const { result } = renderHook(() => usePlanManager(), { wrapper });

    let ok;
    await act(async () => {
      ok = await result.current.addCourseById("ABC", "FS26", "Core");
    });

    expect(ok).toBe(false);
    expect(mockToast.error).toHaveBeenCalledTimes(1);
    expect(mockToast.error).toHaveBeenCalledWith("Could not add course.", {
      toastId: "course-add-error",
    });
  });

  it("a failed enrolment load toasts once, from useScorecardFetching", async () => {
    server.use(
      http.get(`${UNISG_API}/StudyApi/MyEnrollments/currentEnrollments`, notFound)
    );
    const { result } = renderHook(() => useScorecardFetching(), { wrapper });

    let outcome;
    await act(async () => {
      outcome = await result.current.fetchAll("t");
    });

    expect(outcome.success).toBe(false);
    expect(mockToast.error).toHaveBeenCalledTimes(1);
    expect(result.current.error).toMatch(/404/);
  });
});
