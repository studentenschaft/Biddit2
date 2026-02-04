/**
 * MSW Server setup for Node.js test environment (Vitest)
 *
 * This server is only used during tests, not in development or production.
 */

import { setupServer } from "msw/node";
import {
  handlers,
  setErrorMode,
  resetErrorMode,
  ErrorSimulation,
} from "./handlers";

/**
 * Create MSW server with all handlers
 */
export const server = setupServer(...handlers);

/**
 * Re-export utilities for test files
 */
export { setErrorMode, resetErrorMode, ErrorSimulation };

/**
 * Helper to set up server in beforeAll/afterAll hooks
 */
export const setupMswServer = () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "warn" });
  });

  afterEach(() => {
    server.resetHandlers();
    resetErrorMode();
  });

  afterAll(() => {
    server.close();
  });
};
