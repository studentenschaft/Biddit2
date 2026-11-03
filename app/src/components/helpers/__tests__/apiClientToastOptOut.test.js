// Callers that handle a failure themselves (or stay silent on purpose) opt out
// of apiClient's error toast, so a failure shows at most one toast.

import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../test/mocks/server";
import { errorHandlingService } from "../../errorHandling/ErrorHandlingService";
import { fetchScoreCardDetails } from "../../recoil/ApiScorecardDetails";
import { apiClient } from "../axiosClient";
import { catalogUrl, UNISG_API } from "../apiEndpoints";

let handleErrorSpy;

beforeEach(() => {
  // 404 is not retryable, so the request fails at once.
  server.use(
    http.get(catalogUrl("cis-1"), () =>
      HttpResponse.json({ message: "not found" }, { status: 404 })
    )
  );
  handleErrorSpy = vi
    .spyOn(errorHandlingService, "handleError")
    .mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiClient suppressErrorToast", () => {
  it("skips the error handler when the request opts out", async () => {
    await expect(
      apiClient.get(catalogUrl("cis-1"), "t", { suppressErrorToast: true })
    ).rejects.toMatchObject({ response: { status: 404 } });
    expect(handleErrorSpy).not.toHaveBeenCalled();
  });

  it("calls the error handler once by default", async () => {
    await expect(apiClient.get(catalogUrl("cis-1"), "t")).rejects.toMatchObject(
      { response: { status: 404 } }
    );
    expect(handleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it("leaves a scorecard failure to the caller, which reports it once", async () => {
    server.use(
      http.get(`${UNISG_API}/AchievementApi/MyScoreCards/detail/*`, () =>
        HttpResponse.json({ message: "not found" }, { status: 404 })
      )
    );

    await expect(fetchScoreCardDetails("t", "reg-1", 1)).rejects.toMatchObject({
      response: { status: 404 },
    });
    expect(handleErrorSpy).not.toHaveBeenCalled();
  });
});
