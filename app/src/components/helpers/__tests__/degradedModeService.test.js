/**
 * Tests for the degraded-mode kill switch service.
 *
 * Mocks `global.fetch` directly (this module deliberately avoids
 * apiClient/MSW — see the module doc comment) and covers:
 *  - a successful fetch flips state and notifies listeners only on change
 *  - fail-open behaviour on fetch rejection / non-ok / bad JSON / non-boolean
 *  - stop() halting the polling loop
 *  - unsubscribe working
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getDegradedMode,
  addDegradedModeListener,
  startDegradedModePolling,
  _fetchStatusOnce,
  _resetForTests,
  DegradedModeError,
} from "../degradedModeService";

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

describe("degradedModeService", () => {
  beforeEach(() => {
    _resetForTests();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    _resetForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("DegradedModeError", () => {
    it("has the expected name/code/flag", () => {
      const error = new DegradedModeError("nope");
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("DegradedModeError");
      expect(error.code).toBe("DEGRADED_MODE");
      expect(error.isDegradedModeError).toBe(true);
      expect(error.message).toBe("nope");
    });
  });

  describe("_fetchStatusOnce — success", () => {
    it("flips state and notifies listeners when degradedMode changes", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse({
            schemaVersion: 1,
            degradedMode: true,
            message: "Custom message",
            updatedAt: "2026-08-04T00:00:00Z",
          }),
        ),
      );

      const listener = vi.fn();
      addDegradedModeListener(listener);

      expect(getDegradedMode()).toEqual({
        isDegradedMode: false,
        message: null,
      });

      await _fetchStatusOnce();

      expect(getDegradedMode()).toEqual({
        isDegradedMode: true,
        message: "Custom message",
      });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        isDegradedMode: true,
        message: "Custom message",
      });
    });

    it("does not notify listeners when the state does not change", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse({ degradedMode: false, message: null }),
        ),
      );

      const listener = vi.fn();
      addDegradedModeListener(listener);

      await _fetchStatusOnce();

      expect(listener).not.toHaveBeenCalled();
      expect(getDegradedMode()).toEqual({
        isDegradedMode: false,
        message: null,
      });
    });

    it("fetches from /app-status.json with cache: no-store", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ degradedMode: false }));
      vi.stubGlobal("fetch", fetchMock);

      await _fetchStatusOnce();

      expect(fetchMock).toHaveBeenCalledWith("/app-status.json", {
        cache: "no-store",
      });
    });
  });

  describe("fail-open semantics", () => {
    it("leaves state unchanged (false stays false) on fetch rejection", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

      await _fetchStatusOnce();

      expect(getDegradedMode().isDegradedMode).toBe(false);
      expect(console.warn).toHaveBeenCalled();
    });

    it("leaves state unchanged (false stays false) on a non-ok response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({}, false, 500)),
      );

      await _fetchStatusOnce();

      expect(getDegradedMode().isDegradedMode).toBe(false);
      expect(console.warn).toHaveBeenCalled();
    });

    it("leaves state unchanged (false stays false) on JSON parse failure", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      }));

      await _fetchStatusOnce();

      expect(getDegradedMode().isDegradedMode).toBe(false);
      expect(console.warn).toHaveBeenCalled();
    });

    it("leaves state unchanged (false stays false) when degradedMode is not boolean", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({ degradedMode: "true" })),
      );

      await _fetchStatusOnce();

      expect(getDegradedMode().isDegradedMode).toBe(false);
      expect(console.warn).toHaveBeenCalled();
    });

    it("leaves state unchanged (was true stays true) on fetch rejection", async () => {
      // First bring state to true via a valid response.
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({ degradedMode: true, message: "on" })),
      );
      await _fetchStatusOnce();
      expect(getDegradedMode()).toEqual({ isDegradedMode: true, message: "on" });

      // Now a failing fetch must not flip it back to false.
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
      await _fetchStatusOnce();

      expect(getDegradedMode()).toEqual({ isDegradedMode: true, message: "on" });
    });

    it("leaves state unchanged (was true stays true) on non-boolean degradedMode", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({ degradedMode: true, message: "on" })),
      );
      await _fetchStatusOnce();
      expect(getDegradedMode().isDegradedMode).toBe(true);

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({ degradedMode: null })),
      );
      await _fetchStatusOnce();

      expect(getDegradedMode()).toEqual({ isDegradedMode: true, message: "on" });
    });
  });

  describe("startDegradedModePolling", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("fetches immediately and again after the interval elapses", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ degradedMode: false }));
      vi.stubGlobal("fetch", fetchMock);

      startDegradedModePolling({ intervalMs: 100000 });

      // Immediate fetch (fired synchronously, resolves on microtask flush).
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Jitter is +/- 30s, so 130s comfortably covers the next tick.
      await vi.advanceTimersByTimeAsync(130000);
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("stop() halts further polling", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ degradedMode: false }));
      vi.stubGlobal("fetch", fetchMock);

      const stop = startDegradedModePolling({ intervalMs: 100000 });
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      stop();

      await vi.advanceTimersByTimeAsync(500000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("double-start: two starts with NO timer advance between them must not spawn two independent polling loops (regression for the race)", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ degradedMode: false }));
      vi.stubGlobal("fetch", fetchMock);

      // Deliberately no `await`/timer-advance between these two calls: the
      // first call's initial _fetchStatusOnce() is still an in-flight
      // microtask when the second call starts. This is exactly the
      // ordering that exposes the race — a plain `isPolling` boolean can't
      // tell the two loops apart, so the first (stale) loop's scheduleNext
      // can still fire and schedule its own timer once its fetch settles.
      startDegradedModePolling({ intervalMs: 100000 });
      const secondStop = startDegradedModePolling({ intervalMs: 100000 });

      // Each start's immediate fetch runs synchronously; flush the
      // resulting `.finally(scheduleNext)` continuations.
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      secondStop();
      fetchMock.mockClear();

      // A stray timer from an uncancelled first loop would fire somewhere
      // in [70s, 130s] (100s intervalMs +/- 30s jitter) and cause an extra
      // fetch that stop() cannot prevent, since only the most recently
      // written timer is ever tracked by `pollTimeoutId`. With the
      // generation-token fix, advancing well past that window must produce
      // zero further fetches.
      await vi.advanceTimersByTimeAsync(200000);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("stop() from a superseded start is a no-op (does not halt the current loop)", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ degradedMode: false }));
      vi.stubGlobal("fetch", fetchMock);

      const firstStop = startDegradedModePolling({ intervalMs: 100000 });
      const secondStop = startDegradedModePolling({ intervalMs: 100000 });
      await vi.advanceTimersByTimeAsync(0);

      // The stale stop() from the superseded first call must not cancel
      // the second (current) loop.
      firstStop();
      fetchMock.mockClear();

      await vi.advanceTimersByTimeAsync(130000);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      secondStop();
    });
  });

  describe("addDegradedModeListener", () => {
    it("unsubscribe stops further notifications", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({ degradedMode: true })),
      );

      const listener = vi.fn();
      const unsubscribe = addDegradedModeListener(listener);

      await _fetchStatusOnce();
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({ degradedMode: false })),
      );
      await _fetchStatusOnce();

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
