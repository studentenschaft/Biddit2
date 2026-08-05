/**
 * Integration tests for AppStateProvider: network/session events drive the
 * correct blocking modal, with precedence expired > renew > offline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";

// Capture the callbacks the provider registers so we can emit events to it.
let networkCb = null;
let sessionCb = null;
let degradedModeCb = null;
let startPollingCallCount = 0;
const stopPollingSpy = vi.fn();

vi.mock("../../helpers/axiosClient", () => ({
  addNetworkEventListener: (cb) => {
    networkCb = cb;
    return () => {
      networkCb = null;
    };
  },
}));

vi.mock("../../auth/tokenService", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    addSessionEventListener: (cb) => {
      sessionCb = cb;
      return () => {
        sessionCb = null;
      };
    },
    clearSessionAndRedirect: vi.fn(),
  };
});

vi.mock("../../helpers/degradedModeService", () => ({
  getDegradedMode: () => ({ isDegradedMode: false, message: null }),
  addDegradedModeListener: (cb) => {
    degradedModeCb = cb;
    return () => {
      degradedModeCb = null;
    };
  },
  startDegradedModePolling: () => {
    startPollingCallCount++;
    return stopPollingSpy;
  },
}));

import { AppStateProvider } from "../AppStateProvider";
import { SessionEvent } from "../../auth/tokenService";

const renderProvider = () =>
  render(
    <AppStateProvider>
      <div>app content</div>
    </AppStateProvider>,
  );

describe("AppStateProvider", () => {
  beforeEach(() => {
    networkCb = null;
    sessionCb = null;
    degradedModeCb = null;
    startPollingCallCount = 0;
    stopPollingSpy.mockClear();
    sessionStorage.clear();
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
    });
  });

  afterEach(cleanup);

  it("shows the offline modal on an OFFLINE network event", () => {
    renderProvider();
    act(() => networkCb({ type: "OFFLINE" }));

    expect(screen.getByText(/you appear to be offline/i)).toBeInTheDocument();
  });

  it("shows the renew modal on a SESSION_RENEW event", () => {
    renderProvider();
    act(() => sessionCb({ type: SessionEvent.RENEW }));

    expect(screen.getByText(/refresh your session/i)).toBeInTheDocument();
  });

  it("shows the expired modal on a SESSION_EXPIRED event", () => {
    renderProvider();
    act(() => sessionCb({ type: SessionEvent.EXPIRED }));

    expect(
      screen.getByRole("heading", { name: /session expired/i }),
    ).toBeInTheDocument();
  });

  it("expired takes precedence over a pending renew", () => {
    renderProvider();
    act(() => sessionCb({ type: SessionEvent.RENEW }));
    act(() => sessionCb({ type: SessionEvent.EXPIRED }));

    expect(
      screen.getByRole("heading", { name: /session expired/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/refresh your session/i)).not.toBeInTheDocument();
  });

  it("session modals take precedence over offline", () => {
    renderProvider();
    act(() => networkCb({ type: "OFFLINE" }));
    act(() => sessionCb({ type: SessionEvent.RENEW }));

    expect(screen.getByText(/refresh your session/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/you appear to be offline/i),
    ).not.toBeInTheDocument();
  });

  it("starts degraded-mode polling on mount and stops it on unmount", () => {
    const { unmount } = renderProvider();

    expect(startPollingCallCount).toBe(1);
    expect(stopPollingSpy).not.toHaveBeenCalled();

    unmount();

    expect(stopPollingSpy).toHaveBeenCalledTimes(1);
  });

  it("shows the degraded-mode banner when the service reports degraded, coexisting with a blocking modal (no precedence change)", () => {
    renderProvider();
    act(() =>
      degradedModeCb({
        isDegradedMode: true,
        message: "Some features are temporarily reduced.",
      }),
    );
    act(() => sessionCb({ type: SessionEvent.RENEW }));

    expect(
      screen.getByText("Some features are temporarily reduced."),
    ).toBeInTheDocument();
    expect(screen.getByText(/refresh your session/i)).toBeInTheDocument();
  });

  it("degraded-mode banner is absent when the service reports normal mode", () => {
    renderProvider();
    act(() => degradedModeCb({ isDegradedMode: false, message: null }));

    expect(
      screen.queryByText(/temporarily reduced/i),
    ).not.toBeInTheDocument();
  });
});
