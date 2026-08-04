/**
 * Degraded-mode kill switch.
 *
 * Polls the static `/app-status.json` (served from the Netlify CDN, see
 * `public/app-status.json` + `public/_headers`) for a manually-toggled
 * `degradedMode` flag. When true, the axios request interceptor
 * (`axiosClient.js`) short-circuits all requests to `api.shsg.ch` before any
 * network I/O — see `getDegradedMode()`.
 *
 * Uses a plain `fetch` (not `apiClient`) deliberately: no auth is needed for
 * a public static file, and going through axios would create a circular
 * dependency with `axiosClient.js`, which imports this module.
 *
 * FAIL-OPEN: any failure to fetch/parse/validate the status document leaves
 * the current state untouched (log-and-ignore). Initial state is
 * `isDegradedMode: false`, so a status endpoint that never succeeds simply
 * means normal mode forever — degraded mode can only ever be turned on by an
 * explicit, valid `degradedMode: true` in the document.
 */

const STATUS_URL = "/app-status.json";

let isDegradedMode = false;
let message = null;

const listeners = new Set();

let pollTimeoutId = null;
let isPolling = false;

/**
 * Custom error thrown by the axios request interceptor when a request to
 * the SHSG API is rejected because degraded mode is active.
 */
export class DegradedModeError extends Error {
  constructor(message) {
    super(message);
    this.name = "DegradedModeError";
    this.code = "DEGRADED_MODE";
    this.isDegradedModeError = true;
  }
}

/**
 * Synchronous read of the current degraded-mode state. Used by the axios
 * request interceptor, which cannot await a fetch before every request.
 * @returns {{ isDegradedMode: boolean, message: string|null }}
 */
export const getDegradedMode = () => ({ isDegradedMode, message });

/**
 * Subscribe to degraded-mode state changes. The callback fires only when
 * the state actually changes (not on every poll tick).
 * @param {(state: { isDegradedMode: boolean, message: string|null }) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export const addDegradedModeListener = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

const emitIfChanged = (nextIsDegradedMode, nextMessage) => {
  if (nextIsDegradedMode === isDegradedMode && nextMessage === message) {
    return;
  }
  isDegradedMode = nextIsDegradedMode;
  message = nextMessage;
  const state = { isDegradedMode, message };
  listeners.forEach((callback) => callback(state));
};

/**
 * Fetch and apply the status document once. Exported for tests.
 * Fail-open: on any error (network, non-ok, bad JSON, invalid shape), logs a
 * warning and leaves state unchanged.
 * @returns {Promise<void>}
 */
export const _fetchStatusOnce = async () => {
  let response;
  try {
    response = await fetch(STATUS_URL, { cache: "no-store" });
  } catch (error) {
    console.warn("degradedModeService: failed to fetch app-status.json", error);
    return;
  }

  if (!response.ok) {
    console.warn(
      `degradedModeService: app-status.json returned status ${response.status}`,
    );
    return;
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    console.warn("degradedModeService: failed to parse app-status.json", error);
    return;
  }

  if (typeof data?.degradedMode !== "boolean") {
    console.warn(
      "degradedModeService: app-status.json has a non-boolean degradedMode field, ignoring",
    );
    return;
  }

  const nextMessage =
    typeof data.message === "string" || data.message === null
      ? data.message
      : message;

  emitIfChanged(data.degradedMode, nextMessage);
};

/**
 * Start polling `/app-status.json`. Fetches immediately, then reschedules
 * itself on each tick via `setTimeout` with `intervalMs` +/- 30s of jitter
 * (rather than `setInterval`, which would apply the same fixed delay every
 * time and is harder to reason about/test per-tick).
 *
 * Double-start guard: calling this while already polling stops the previous
 * polling loop first and starts a fresh one with the new options. This is
 * the simplest semantics that can't leave two overlapping loops running.
 *
 * @param {{ intervalMs?: number }} [options]
 * @returns {() => void} stop() — halts polling
 */
export const startDegradedModePolling = ({ intervalMs = 300000 } = {}) => {
  if (isPolling) {
    stopPolling();
  }
  isPolling = true;

  const scheduleNext = () => {
    if (!isPolling) return;
    const jitter = Math.random() * 60000 - 30000; // +/- 30s
    const delay = Math.max(0, intervalMs + jitter);
    pollTimeoutId = setTimeout(async () => {
      await _fetchStatusOnce();
      scheduleNext();
    }, delay);
  };

  // Fire immediately, then schedule the first jittered tick once it settles.
  _fetchStatusOnce().finally(scheduleNext);

  return stopPolling;
};

function stopPolling() {
  isPolling = false;
  if (pollTimeoutId !== null) {
    clearTimeout(pollTimeoutId);
    pollTimeoutId = null;
  }
}

/**
 * Reset all module state. Test-only.
 */
export const _resetForTests = () => {
  stopPolling();
  isDegradedMode = false;
  message = null;
  listeners.clear();
};
