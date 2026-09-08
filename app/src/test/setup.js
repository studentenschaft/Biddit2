import "@testing-library/jest-dom";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./mocks/server";
import { resetErrorMode } from "./mocks/handlers";

/**
 * Global test setup for Vitest
 * Initializes MSW server for API mocking
 */

// No test should load the gtag script or hit Google. Per-file mocks override this.
vi.mock("react-ga4", () => ({
  default: {
    initialize: vi.fn(),
    event: vi.fn(),
    gtag: vi.fn(),
  },
}));

// Start MSW server before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: "warn",
  });
});

// Reset handlers and error mode after each test
afterEach(() => {
  server.resetHandlers();
  resetErrorMode();
});

// Close server after all tests
afterAll(() => {
  server.close();
});

// Mock navigator.onLine for offline testing
Object.defineProperty(navigator, "onLine", {
  writable: true,
  value: true,
});

// jsdom has no ResizeObserver. Provide a no-op global so components that use
// one (e.g. useHorizontalScrollAffordance, DegradedModeBanner) don't crash
// in tests that don't care about resize behavior; tests that do care stub
// their own richer mock via vi.stubGlobal, which takes precedence and is
// restored to this default by vi.unstubAllGlobals() in their afterEach.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
