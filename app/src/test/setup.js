import "@testing-library/jest-dom";
import { server } from "./mocks/server";
import { resetErrorMode } from "./mocks/handlers";

/**
 * Global test setup for Vitest
 * Initializes MSW server for API mocking
 */

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
