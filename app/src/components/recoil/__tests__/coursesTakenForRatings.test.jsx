/**
 * Covers the degraded-mode console-noise fix in coursesTakenForRatings.js:
 * when the kill switch is ON and a request is in flight, the SHSG call
 * rejects with a DegradedModeError - expected traffic, not a real failure -
 * so the atom's catch block must fall back to [] silently instead of
 * logging via console.error.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { RecoilRoot } from "recoil";
import { useRecoilValue } from "recoil";
import {
  _fetchStatusOnce,
  _resetForTests,
} from "../../helpers/degradedModeService";
import { coursesRatedState } from "../coursesTakenForRatings";

const wrapper = ({ children }) => <RecoilRoot>{children}</RecoilRoot>;

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

describe("coursesRatedState (degraded mode)", () => {
  beforeEach(() => {
    _resetForTests();
  });

  afterEach(() => {
    _resetForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("resolves to [] without logging via console.error when the kill switch is on", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ degradedMode: true })),
    );
    await _fetchStatusOnce();

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { result } = renderHook(() => useRecoilValue(coursesRatedState), {
      wrapper,
    });

    await waitFor(() => expect(result.current).toEqual([]));

    // Assert on the specific message rather than "not called at all" - an
    // unrelated Recoil/React batching warning also goes through
    // console.error in this test harness and isn't what's under test here.
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      "Error fetching rated courses:",
      expect.anything(),
    );
  });
});
