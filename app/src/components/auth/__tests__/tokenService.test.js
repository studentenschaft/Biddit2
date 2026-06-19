/**
 * Tests for the session/token service event model.
 *
 * Verifies that getRefreshToken is the single source of truth for session
 * events and emits the correct signal per failure cause:
 *   - genuinely dead (no account / InteractionRequired) -> SESSION_EXPIRED
 *   - transient (BrowserAuthError / popup hiccup)        -> SESSION_RENEW
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  InteractionRequiredAuthError,
  BrowserAuthError,
} from "@azure/msal-browser";
import { msalInstance } from "../authConfig";
import {
  getRefreshToken,
  addSessionEventListener,
  resetSessionState,
  SessionEvent,
} from "../tokenService";

const ACCOUNT = { homeAccountId: "abc", username: "test@unisg.ch" };

describe("tokenService.getRefreshToken", () => {
  let events;
  let unsubscribe;

  beforeEach(() => {
    resetSessionState();
    events = [];
    unsubscribe = addSessionEventListener((e) => events.push(e.type));

    vi.spyOn(msalInstance, "initialize").mockResolvedValue(undefined);
  });

  afterEach(() => {
    unsubscribe();
    vi.restoreAllMocks();
  });

  it("returns the access token on a successful silent refresh (no event)", async () => {
    vi.spyOn(msalInstance, "getAllAccounts").mockReturnValue([ACCOUNT]);
    vi.spyOn(msalInstance, "acquireTokenSilent").mockResolvedValue({
      accessToken: "fresh-token",
    });

    const token = await getRefreshToken();

    expect(token).toBe("fresh-token");
    expect(events).toEqual([]);
  });

  it("emits SESSION_EXPIRED when there are no accounts", async () => {
    vi.spyOn(msalInstance, "getAllAccounts").mockReturnValue([]);

    const token = await getRefreshToken();

    expect(token).toBeNull();
    expect(events).toContain(SessionEvent.EXPIRED);
    expect(events).not.toContain(SessionEvent.RENEW);
  });

  it("emits SESSION_EXPIRED on InteractionRequiredAuthError", async () => {
    vi.spyOn(msalInstance, "getAllAccounts").mockReturnValue([ACCOUNT]);
    vi.spyOn(msalInstance, "acquireTokenSilent").mockRejectedValue(
      new InteractionRequiredAuthError("interaction_required"),
    );

    const token = await getRefreshToken();

    expect(token).toBeNull();
    expect(events).toContain(SessionEvent.EXPIRED);
  });

  it("emits SESSION_RENEW on a transient BrowserAuthError when popup recovery fails transiently", async () => {
    vi.spyOn(msalInstance, "getAllAccounts").mockReturnValue([ACCOUNT]);
    vi.spyOn(msalInstance, "acquireTokenSilent").mockRejectedValue(
      new BrowserAuthError("monitor_window_timeout"),
    );
    // Popup recovery also fails, but transiently (popup blocked / timeout).
    vi.spyOn(msalInstance, "acquireTokenPopup").mockRejectedValue(
      new BrowserAuthError("popup_window_error"),
    );

    const token = await getRefreshToken();

    expect(token).toBeNull();
    expect(events).toContain(SessionEvent.RENEW);
    expect(events).not.toContain(SessionEvent.EXPIRED);
  });

  it("recovers via popup after a BrowserAuthError (no event)", async () => {
    vi.spyOn(msalInstance, "getAllAccounts").mockReturnValue([ACCOUNT]);
    vi.spyOn(msalInstance, "acquireTokenSilent").mockRejectedValue(
      new BrowserAuthError("monitor_window_timeout"),
    );
    vi.spyOn(msalInstance, "acquireTokenPopup").mockResolvedValue({
      accessToken: "popup-token",
    });

    const token = await getRefreshToken();

    expect(token).toBe("popup-token");
    expect(events).toEqual([]);
  });
});
