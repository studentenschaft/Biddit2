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

// jsdom has no ResizeObserver; the tooltips (floating-ui) and the scroll
// affordance watch element sizes with one. Tests that need callbacks stub
// their own.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

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
