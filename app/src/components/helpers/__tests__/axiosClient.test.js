/**
 * Comprehensive API Error Simulation Tests
 *
 * Tests the resilient error handling system including:
 * - 401 → token refresh → retry success
 * - 401 → refresh fail → session expired redirect
 * - Error classification
 * - Request queuing during token refresh
 * - MSAL errors handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import {
  server,
  setErrorMode,
  resetErrorMode,
  ErrorSimulation,
} from "../../../test/mocks/server";
import { apiClient, addNetworkEventListener, isShsgHost } from "../axiosClient";
import * as tokenService from "../../auth/tokenService";
import * as degradedModeService from "../degradedModeService";
import { errorHandlingService } from "../../errorHandling/ErrorHandlingService";

// Mock the toast library
vi.mock("react-toastify", () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Test URLs
const SHSG_API = "https://api.shsg.ch";
const TEST_TOKEN = "test-auth-token";
const NEW_TOKEN = "new-refreshed-token";

describe("ApiClient Error Handling", () => {
  beforeEach(() => {
    // Reset client state
    apiClient.reset();
    resetErrorMode();
    vi.clearAllMocks();

    // Reset navigator.onLine
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Successful Requests", () => {
    it("should make successful GET request", async () => {
      const response = await apiClient.get(
        `${SHSG_API}/study-plans`,
        TEST_TOKEN,
      );

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    });

    it("should make successful POST request", async () => {
      const response = await apiClient.post(
        `${SHSG_API}/study-plans/FS26/1,234,1.00`,
        {},
        TEST_TOKEN,
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });
  });

  describe("401 Unauthorized Handling", () => {
    it("should refresh token and retry on 401", async () => {
      let callCount = 0;

      // Override handler to return 401 first, then success
      server.use(
        http.get(`${SHSG_API}/study-plans`, () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json(
              { message: "Token expired" },
              { status: 401 },
            );
          }
          return HttpResponse.json({ plans: [] });
        }),
      );

      // Mock successful token refresh
      vi.spyOn(tokenService, "getRefreshToken").mockResolvedValue(NEW_TOKEN);

      const response = await apiClient.get(
        `${SHSG_API}/study-plans`,
        TEST_TOKEN,
      );

      expect(response.status).toBe(200);
      expect(tokenService.getRefreshToken).toHaveBeenCalledTimes(1);
      expect(callCount).toBe(2); // Original + retry
    });

    it("should trigger session expired when token refresh fails", async () => {
      setErrorMode(ErrorSimulation.UNAUTHORIZED_401);

      // Mock failed token refresh
      vi.spyOn(tokenService, "getRefreshToken").mockResolvedValue(null);
      const handleAuthFailureSpy = vi
        .spyOn(tokenService, "handleAuthFailure")
        .mockImplementation(() => {});

      await expect(
        apiClient.get(`${SHSG_API}/study-plans`, TEST_TOKEN),
      ).rejects.toThrow();

      expect(handleAuthFailureSpy).toHaveBeenCalled();
    });

    it("should track consecutive auth failures", async () => {
      // Test the internal tracking by checking behavior
      // When getRefreshToken returns null, handleAuthFailure is called
      vi.spyOn(tokenService, "getRefreshToken").mockResolvedValue(null);
      const handleAuthFailureSpy = vi
        .spyOn(tokenService, "handleAuthFailure")
        .mockImplementation(() => {});

      server.use(
        http.get(`${SHSG_API}/study-plans`, () => {
          return HttpResponse.json(
            { message: "Unauthorized" },
            { status: 401 },
          );
        }),
      );

      // Single request should trigger handleAuthFailure when refresh fails
      try {
        await apiClient.get(`${SHSG_API}/study-plans`, TEST_TOKEN);
      } catch (e) {
        // Expected
      }

      expect(handleAuthFailureSpy).toHaveBeenCalled();
    });
  });

  describe("Network Error Handling", () => {
    it("should emit OFFLINE event when offline", async () => {
      const events = [];
      const unsubscribe = addNetworkEventListener((event) =>
        events.push(event),
      );

      // Simulate offline
      Object.defineProperty(navigator, "onLine", { value: false });

      try {
        await apiClient.get(`${SHSG_API}/study-plans`, TEST_TOKEN);
      } catch (e) {
        // Expected
      }

      expect(events.some((e) => e.type === "OFFLINE")).toBe(true);

      unsubscribe();
    });

    it("should detect network errors", async () => {
      // Test that network errors are properly classified
      const error = { code: "ERR_NETWORK", _isNetworkError: true };
      const classification = errorHandlingService.classifyError(error);

      expect(classification.type).toBe("NETWORK");
      expect(classification.isRecoverable).toBe(true);
    });

    it("should emit OFFLINE (not a toast) for a genuine network error after retries, even when navigator reports online", async () => {
      vi.useFakeTimers();

      // navigator.onLine stays true (captive portal / server unreachable case)
      Object.defineProperty(navigator, "onLine", { value: true });

      // Every attempt is a network-level failure
      server.use(
        http.get(`${SHSG_API}/study-plans`, () => HttpResponse.error()),
      );

      const events = [];
      const unsubscribe = addNetworkEventListener((event) =>
        events.push(event),
      );

      const request = apiClient
        .get(`${SHSG_API}/study-plans`, TEST_TOKEN)
        .catch((e) => e);

      // Flush the backoff timers + microtasks for all retries
      await vi.runAllTimersAsync();
      const result = await request;

      expect(result).toBeInstanceOf(Error);
      expect(events.some((e) => e.type === "OFFLINE")).toBe(true);
      // Network errors must never produce a reportable error toast
      expect(errorHandlingService.classifyError(result).shouldShowToast).toBe(
        false,
      );

      unsubscribe();
      vi.useRealTimers();
    });
  });

  describe("Request Queuing During Token Refresh", () => {
    it("should queue concurrent requests during token refresh", async () => {
      let callCount = 0;
      let refreshCount = 0;

      // First request returns 401, subsequent succeed
      server.use(
        http.get(`${SHSG_API}/study-plans`, () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json(
              { message: "Unauthorized" },
              { status: 401 },
            );
          }
          return HttpResponse.json({ plans: [] });
        }),
      );

      // Mock token refresh with short delay
      vi.spyOn(tokenService, "getRefreshToken").mockImplementation(async () => {
        refreshCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return NEW_TOKEN;
      });

      // Make 3 concurrent requests
      const responses = await Promise.all([
        apiClient.get(`${SHSG_API}/study-plans`, TEST_TOKEN),
        apiClient.get(`${SHSG_API}/study-plans`, TEST_TOKEN),
        apiClient.get(`${SHSG_API}/study-plans`, TEST_TOKEN),
      ]);

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Token should only be refreshed once due to queuing
      expect(refreshCount).toBe(1);
    });
  });

  describe("Error Classification", () => {
    it("should classify network errors as recoverable", () => {
      const error = { code: "ERR_NETWORK", _isNetworkError: true };
      const classification = errorHandlingService.classifyError(error);

      expect(classification.type).toBe("NETWORK");
      expect(classification.isRecoverable).toBe(true);
      expect(classification.shouldShowToast).toBe(false);
    });

    it("should classify timeout errors correctly", () => {
      const error = { code: "ECONNABORTED", message: "timeout" };
      const classification = errorHandlingService.classifyError(error);

      expect(classification.type).toBe("TIMEOUT");
      expect(classification.isRecoverable).toBe(true);
    });

    it("should classify 401 as recoverable", () => {
      const error = { response: { status: 401 } };
      const classification = errorHandlingService.classifyError(error);

      expect(classification.type).toBe("AUTH");
      expect(classification.isRecoverable).toBe(true);
      expect(classification.shouldShowToast).toBe(false);
    });

    it("should classify 500 after max retries as non-recoverable", () => {
      const error = {
        response: { status: 500 },
        _isMaxRetriesExceeded: true,
      };
      const classification = errorHandlingService.classifyError(error);

      expect(classification.type).toBe("SERVER");
      expect(classification.isRecoverable).toBe(false);
      expect(classification.shouldShowToast).toBe(true);
    });

    it("should classify 404 as non-recoverable", () => {
      const error = { response: { status: 404 } };
      const classification = errorHandlingService.classifyError(error);

      expect(classification.type).toBe("CLIENT");
      expect(classification.isRecoverable).toBe(false);
      expect(classification.shouldShowToast).toBe(true);
    });

    it("should classify MSAL BrowserAuthError as recoverable", () => {
      const error = {
        name: "BrowserAuthError",
        message: "monitor_window_timeout: Token acquisition in iframe failed",
      };
      const classification = errorHandlingService.classifyError(error);

      expect(classification.type).toBe("MSAL");
      expect(classification.isRecoverable).toBe(true);
      expect(classification.shouldShowToast).toBe(false);
    });

    it("should classify InteractionRequiredAuthError as recoverable", () => {
      const error = {
        name: "InteractionRequiredAuthError",
        message: "User interaction required",
      };
      const classification = errorHandlingService.classifyError(error);

      expect(classification.type).toBe("MSAL");
      expect(classification.isRecoverable).toBe(true);
      expect(classification.shouldShowToast).toBe(false);
    });

    it("should classify popup_window_error as MSAL error", () => {
      const error = {
        message: "popup_window_error: Popup window blocked",
      };
      const classification = errorHandlingService.classifyError(error);

      expect(classification.type).toBe("MSAL");
      expect(classification.isRecoverable).toBe(true);
    });
  });

  describe("Error Simulation Modes", () => {
    it("should simulate 401 error when mode is set", async () => {
      setErrorMode(ErrorSimulation.UNAUTHORIZED_401);

      vi.spyOn(tokenService, "getRefreshToken").mockResolvedValue(null);
      vi.spyOn(tokenService, "handleAuthFailure").mockImplementation(() => {});

      await expect(
        apiClient.get(`${SHSG_API}/study-plans`, TEST_TOKEN),
      ).rejects.toThrow();
    });

    it("should simulate 403 forbidden error", async () => {
      setErrorMode(ErrorSimulation.FORBIDDEN_403);

      try {
        await apiClient.get(`${SHSG_API}/study-plans`, TEST_TOKEN);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error.response.status).toBe(403);
      }
    });

    it("should simulate 404 not found error", async () => {
      setErrorMode(ErrorSimulation.NOT_FOUND_404);

      try {
        await apiClient.get(`${SHSG_API}/study-plans`, TEST_TOKEN);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error.response.status).toBe(404);
      }
    });

    it("should only affect matching endpoints when pattern is set", async () => {
      setErrorMode(ErrorSimulation.NOT_FOUND_404, "course-ratings");

      // This should succeed (doesn't match pattern)
      const response = await apiClient.get(
        `${SHSG_API}/study-plans`,
        TEST_TOKEN,
      );
      expect(response.status).toBe(200);

      // This should fail (matches pattern)
      try {
        await apiClient.get(`${SHSG_API}/course-ratings/test`, TEST_TOKEN);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error.response.status).toBe(404);
      }
    });
  });

  describe("Client Reset", () => {
    it("should reset internal state", () => {
      // Set some state
      apiClient.consecutiveAuthFailures = 5;
      apiClient.isRefreshing = true;

      // Reset
      apiClient.reset();

      // Verify reset
      expect(apiClient.consecutiveAuthFailures).toBe(0);
      expect(apiClient.isRefreshing).toBe(false);
    });
  });
});

describe("Degraded Mode", () => {
  afterEach(() => {
    degradedModeService._resetForTests();
  });

  it("rejects SHSG requests with code DEGRADED_MODE without touching the network", async () => {
    let handlerCalled = false;
    server.use(
      http.get(`${SHSG_API}/study-plans`, () => {
        handlerCalled = true;
        return HttpResponse.json({ plans: [] });
      }),
    );

    vi.spyOn(degradedModeService, "getDegradedMode").mockReturnValue({
      isDegradedMode: true,
      message: null,
    });

    await expect(
      apiClient.get(`${SHSG_API}/study-plans`, TEST_TOKEN),
    ).rejects.toMatchObject({ code: "DEGRADED_MODE", isDegradedModeError: true });

    expect(handlerCalled).toBe(false);
  });

  it("leaves requests to integration.unisg.ch unaffected", async () => {
    vi.spyOn(degradedModeService, "getDegradedMode").mockReturnValue({
      isDegradedMode: true,
      message: null,
    });

    const response = await apiClient.get(
      "https://integration.unisg.ch/EventApi/Events/test",
      TEST_TOKEN,
    );

    expect(response.status).toBe(200);
  });

  it("allows SHSG requests again after degraded mode flips off", async () => {
    const spy = vi.spyOn(degradedModeService, "getDegradedMode");
    spy.mockReturnValue({ isDegradedMode: true, message: null });

    await expect(
      apiClient.get(`${SHSG_API}/study-plans`, TEST_TOKEN),
    ).rejects.toMatchObject({ code: "DEGRADED_MODE" });

    spy.mockReturnValue({ isDegradedMode: false, message: null });

    const response = await apiClient.get(`${SHSG_API}/study-plans`, TEST_TOKEN);
    expect(response.status).toBe(200);
  });
});

describe("isShsgHost", () => {
  it("returns true for an absolute SHSG url", () => {
    expect(isShsgHost("https://api.shsg.ch/study-plans")).toBe(true);
  });

  it("returns false for an absolute unisg url", () => {
    expect(isShsgHost("https://integration.unisg.ch/EventApi/Events")).toBe(
      false,
    );
  });

  it("returns false for a relative url", () => {
    expect(isShsgHost("/app-status.json")).toBe(false);
  });

  it("returns false for garbage input", () => {
    expect(isShsgHost(undefined)).toBe(false);
    expect(isShsgHost(null)).toBe(false);
    expect(isShsgHost("::not a url::")).toBe(false);
  });
});

describe("Error Handling Service", () => {
  it("should format string errors correctly", () => {
    const result = errorHandlingService.formatError("Simple error message");
    expect(result).toBe("Simple error message");
  });

  it("should format Error objects correctly", () => {
    const error = new Error("Test error");
    const result = errorHandlingService.formatError(error);
    const parsed = JSON.parse(result);

    expect(parsed.name).toBe("Error");
    expect(parsed.message).toBe("Test error");
    expect(parsed.stack).toBeDefined();
  });

  it("should format plain objects correctly", () => {
    const error = { code: "ERR_TEST", details: "Some details" };
    const result = errorHandlingService.formatError(error);
    const parsed = JSON.parse(result);

    expect(parsed.code).toBe("ERR_TEST");
    expect(parsed.details).toBe("Some details");
  });
});
