/**
 * Covers the degraded-mode console-noise fix: handleError logs DEGRADED_MODE
 * classifications via the development-only log.debug (never console.error),
 * since an in-flight request rejected by the kill switch is expected traffic,
 * not a real failure. Non-degraded errors keep logging via console.error.
 * Also covers the redaction of request bodies outside development builds.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { errorHandlingService } from "../ErrorHandlingService";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("errorHandlingService.handleError (degraded mode)", () => {
  const degradedError = () =>
    Object.assign(new Error("SHSG API disabled"), {
      isDegradedModeError: true,
      code: "DEGRADED_MODE",
    });

  it("logs via log.debug, not console.error, for a DegradedModeError in DEV", () => {
    vi.stubEnv("DEV", true);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const consoleLogSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    errorHandlingService.handleError(degradedError());

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Caught error:",
      expect.objectContaining({ errorType: "DEGRADED_MODE" }),
    );
  });

  it("logs nothing for a DegradedModeError outside DEV", () => {
    vi.stubEnv("DEV", false);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const consoleLogSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    errorHandlingService.handleError(degradedError());

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
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

describe("errorHandlingService.handleError (request details)", () => {
  const errorWithBody = () =>
    Object.assign(new Error("Request failed"), {
      config: {
        url: "https://api.shsg.ch/custom-grades",
        method: "post",
        data: { grade: 5.5 },
        params: { courseNumber: "7,035,1.00" },
      },
      response: { status: 400, data: {} },
    });

  it("redacts the request body and params outside DEV", () => {
    vi.stubEnv("DEV", false);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    errorHandlingService.handleError(errorWithBody());

    const [, errorDetails] = consoleErrorSpy.mock.calls[0];
    expect(errorDetails.data).toBe("[redacted]");
    expect(errorDetails.params).toBe("[redacted]");
    expect(errorDetails.url).toBe("https://api.shsg.ch/custom-grades");
  });

  it("keeps the request body and params in DEV", () => {
    vi.stubEnv("DEV", true);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    errorHandlingService.handleError(errorWithBody());

    const [, errorDetails] = consoleErrorSpy.mock.calls[0];
    expect(errorDetails.data).toEqual({ grade: 5.5 });
    expect(errorDetails.params).toEqual({ courseNumber: "7,035,1.00" });
  });
});
