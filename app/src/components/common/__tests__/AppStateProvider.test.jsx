/**
 * Integration tests for AppStateProvider: network/session events drive the
 * correct blocking modal, with precedence expired > renew > offline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";

// Capture the callbacks the provider registers so we can emit events to it.
let networkCb = null;
let sessionCb = null;

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
});
