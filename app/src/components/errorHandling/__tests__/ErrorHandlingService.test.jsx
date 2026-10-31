/**
 * Covers the degraded-mode console-noise fix: handleError logs DEGRADED_MODE
 * classifications via console.debug (never console.error), since an
 * in-flight request rejected by the kill switch is expected traffic, not a
 * real failure. Non-degraded errors keep logging via console.error.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { errorHandlingService } from "../ErrorHandlingService";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("errorHandlingService.handleError (degraded mode)", () => {
  it("logs via console.debug, not console.error, for a DegradedModeError", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const consoleDebugSpy = vi
      .spyOn(console, "debug")
      .mockImplementation(() => {});

    const degradedError = Object.assign(new Error("SHSG API disabled"), {
      isDegradedModeError: true,
      code: "DEGRADED_MODE",
    });

    errorHandlingService.handleError(degradedError);

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      "Caught error:",
      expect.objectContaining({ errorType: "DEGRADED_MODE" }),
    );
  });

  it("still logs via console.error for a non-degraded error", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    errorHandlingService.handleError(new Error("boom"));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Caught error:",
      expect.objectContaining({ errorType: "UNKNOWN" }),
    );
  });
});
