// A failed ratings load is reported once: by the hook, not also by apiClient.

import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { RecoilRoot } from "recoil";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../test/mocks/server";
import { errorHandlingService } from "../../errorHandling/ErrorHandlingService";
import { SHSG_API } from "../apiEndpoints";
import { useCourseRatingsData } from "../useCourseRatingsData";

const wrapper = ({ children }) => <RecoilRoot>{children}</RecoilRoot>;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useCourseRatingsData", () => {
  // A 404 is not retried, so the failure lands at once without fake timers.
  it("a failed load reports once", async () => {
    server.use(
      http.get(`${SHSG_API}/course-ratings`, () =>
        HttpResponse.json({ message: "not found" }, { status: 404 })
      )
    );
    const spy = vi
      .spyOn(errorHandlingService, "handleError")
      .mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useCourseRatingsData({ authToken: "t" }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isCourseRatingsLoading).toBe(false));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
