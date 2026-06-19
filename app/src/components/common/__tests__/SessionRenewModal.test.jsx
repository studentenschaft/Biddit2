/**
 * Tests for SessionRenewModal: refresh-first, then escalate to log-out / report
 * on recurrence (detected via a sessionStorage marker that survives the reload).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Mock the auth side-effects so clicks don't try to navigate the jsdom window.
vi.mock("../../auth/tokenService", () => ({
  clearSessionAndRedirect: vi.fn(),
}));

import SessionRenewModal from "../SessionRenewModal";
import { clearSessionAndRedirect } from "../../auth/tokenService";

const RENEW_ATTEMPT_KEY = "biddit.sessionRenewAttemptedAt";

describe("SessionRenewModal", () => {
  let reloadSpy;

  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();

    // Stub window.location.reload (not implemented in jsdom)
    reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, reload: reloadSpy, href: "http://test/" },
    });
  });

  afterEach(cleanup);

  it("renders nothing when not visible", () => {
    const { container } = render(<SessionRenewModal isVisible={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("first occurrence: prompts a page refresh and marks the attempt", () => {
    render(<SessionRenewModal isVisible={true} />);

    expect(
      screen.getByRole("button", { name: /refresh page/i }),
    ).toBeInTheDocument();
    // No report button on the first step
    expect(
      screen.queryByRole("button", { name: /send error/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /refresh page/i }));

    expect(sessionStorage.getItem(RENEW_ATTEMPT_KEY)).toBeTruthy();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("recurrence: escalates to log out / back in and offers a report", () => {
    // Simulate a refresh attempt that just happened
    sessionStorage.setItem(RENEW_ATTEMPT_KEY, String(Date.now()));

    render(<SessionRenewModal isVisible={true} />);

    expect(
      screen.getByRole("button", { name: /log out and back in/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send error/i }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /log out and back in/i }),
    );
    expect(clearSessionAndRedirect).toHaveBeenCalledTimes(1);
  });

  it("treats a stale attempt marker as a fresh occurrence", () => {
    // Older than the recurrence window (2 min)
    sessionStorage.setItem(
      RENEW_ATTEMPT_KEY,
      String(Date.now() - 5 * 60 * 1000),
    );

    render(<SessionRenewModal isVisible={true} />);

    expect(
      screen.getByRole("button", { name: /refresh page/i }),
    ).toBeInTheDocument();
  });
});
