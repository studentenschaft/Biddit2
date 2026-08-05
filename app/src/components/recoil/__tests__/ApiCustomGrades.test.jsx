/**
 * Covers the degraded-mode console-noise fix in ApiCustomGrades.jsx:
 * fetchCustomGrades falls back to {} on any error, but must only log via
 * console.error / errorHandlingService.handleError for real failures - not
 * for an expected in-flight DegradedModeError from the kill switch.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchCustomGrades } from "../ApiCustomGrades";
import { apiClient } from "../../helpers/axiosClient";
import { errorHandlingService } from "../../errorHandling/ErrorHandlingService";

vi.mock("../../helpers/axiosClient", () => ({
  apiClient: { get: vi.fn() },
}));

vi.mock("../../errorHandling/ErrorHandlingService", () => ({
  errorHandlingService: { handleError: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("fetchCustomGrades (degraded mode)", () => {
  it("returns {} silently, without console.error or handleError, for a DegradedModeError", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const degradedError = Object.assign(new Error("SHSG API disabled"), {
      isDegradedModeError: true,
      code: "DEGRADED_MODE",
    });
    apiClient.get.mockRejectedValue(degradedError);

    const result = await fetchCustomGrades("token");

    expect(result).toEqual({});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(errorHandlingService.handleError).not.toHaveBeenCalled();
  });

  it("still logs and reports a real (non-degraded) fetch failure", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const realError = new Error("network down");
    apiClient.get.mockRejectedValue(realError);

    const result = await fetchCustomGrades("token");

    expect(result).toEqual({});
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error fetching custom grades:",
      realError,
    );
    expect(errorHandlingService.handleError).toHaveBeenCalledWith(realError);
  });
});
