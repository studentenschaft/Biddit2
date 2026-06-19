import {
  InteractionRequiredAuthError,
  BrowserAuthError,
} from "@azure/msal-browser";
import { msalInstance, initializeMsalInstance, apiScopes } from "./authConfig";

/**
 * Session event types emitted to listeners (consumed by AppStateProvider).
 * - SESSION_EXPIRED: session is genuinely dead (re-login required).
 * - SESSION_RENEW:   transient failure (iframe/popup hiccup); a page refresh
 *                    usually recovers it without forcing a re-login.
 */
export const SessionEvent = {
  EXPIRED: "SESSION_EXPIRED",
  RENEW: "SESSION_RENEW",
};

// Count of genuine (non-transient) auth failures. Used to escalate to a
// definitive "session expired" once we're confident the session is dead.
let sessionDeathCount = 0;
const MAX_SESSION_FAILURES = 3;

// Event emitter for session state changes
const sessionEventListeners = new Set();

export const addSessionEventListener = (callback) => {
  sessionEventListeners.add(callback);
  return () => sessionEventListeners.delete(callback);
};

const emitSessionEvent = (eventType, data = {}) => {
  sessionEventListeners.forEach((callback) =>
    callback({ type: eventType, ...data }),
  );
};

/**
 * Global function to get a fresh token for the axios interceptor.
 * Uses the shared MSAL instance from authConfig and is the single source of
 * truth for session events: callers should simply react to a null return and
 * let the emitted event drive any UI.
 * @returns {Promise<string|null>} New access token or null if refresh failed
 */
export const getRefreshToken = async () => {
  try {
    await initializeMsalInstance();
    const accounts = msalInstance.getAllAccounts();

    if (accounts.length === 0) {
      // No account at all → the session is genuinely gone.
      console.error("No accounts found - session expired");
      emitSessionEvent(SessionEvent.EXPIRED);
      return null;
    }

    const account = accounts[0];

    try {
      // Try silent token acquisition first
      const response = await msalInstance.acquireTokenSilent({
        account,
        scopes: apiScopes,
      });
      // Reset failure count on success
      sessionDeathCount = 0;
      return response.accessToken;
    } catch (silentError) {
      // InteractionRequiredAuthError → session expired, full re-login needed.
      if (silentError instanceof InteractionRequiredAuthError) {
        console.log("Interaction required - session expired");
        emitSessionEvent(SessionEvent.EXPIRED);
        return null;
      }

      // BrowserAuthError (monitor_window_timeout, popup_window_error, etc.) is
      // typically a transient iframe issue while the session is still valid.
      // Try a popup recovery; if that also fails transiently, prompt a refresh.
      if (silentError instanceof BrowserAuthError) {
        console.warn(
          "Browser auth error during silent acquisition:",
          silentError.errorCode,
        );
        return await attemptPopupRecovery();
      }

      throw silentError;
    }
  } catch (error) {
    console.error("Failed to refresh token:", error);
    sessionDeathCount++;

    // Only escalate to a definitive "expired" once we've seen repeated genuine
    // failures; otherwise prompt a (less disruptive) refresh.
    if (sessionDeathCount >= MAX_SESSION_FAILURES) {
      emitSessionEvent(SessionEvent.EXPIRED);
    } else {
      emitSessionEvent(SessionEvent.RENEW);
    }

    return null;
  }
};

/**
 * Attempt popup recovery for BrowserAuthError (monitor_window_timeout, etc.).
 * Used when silent acquisition fails due to iframe issues but the session may
 * still be valid. NOTE: a popup launched from a background interceptor (no user
 * gesture) is usually blocked by the browser and falls through to the refresh
 * prompt — that is expected.
 * @returns {Promise<string|null>} Access token or null
 */
const attemptPopupRecovery = async () => {
  try {
    const response = await msalInstance.acquireTokenPopup({
      scopes: apiScopes,
    });
    sessionDeathCount = 0;
    return response.accessToken;
  } catch (popupError) {
    console.warn("Popup recovery failed:", popupError);

    // A genuine interaction-required error means the session is dead.
    if (popupError instanceof InteractionRequiredAuthError) {
      sessionDeathCount++;
      emitSessionEvent(
        sessionDeathCount >= MAX_SESSION_FAILURES
          ? SessionEvent.EXPIRED
          : SessionEvent.RENEW,
      );
    } else {
      // Transient (popup blocked, timeout): a page refresh usually fixes this.
      // Do not count it toward session death or force a re-login.
      emitSessionEvent(SessionEvent.RENEW);
    }

    return null;
  }
};

/**
 * Handle authentication failure. Logs only — session events are owned by
 * getRefreshToken, which already emitted the correct (EXPIRED vs RENEW) signal.
 * Kept for backward compatibility with existing callers.
 * @param {Error} error - The authentication error
 */
export const handleAuthFailure = (error) => {
  console.error("Authentication failed:", error);
};

/**
 * Clear session and redirect to login.
 * Called when the session is definitively dead or the user chooses to re-login.
 */
export const clearSessionAndRedirect = () => {
  // Clear active account
  msalInstance.setActiveAccount(null);

  // Clear all MSAL-related localStorage entries
  Object.keys(localStorage).forEach((key) => {
    if (
      key.startsWith("msal.") ||
      key.includes("login.windows.net") ||
      key.includes("login.microsoftonline.com")
    ) {
      localStorage.removeItem(key);
    }
  });

  // Reset failure counter
  sessionDeathCount = 0;

  // Redirect to login
  window.location.href = window.location.origin + "/login";
};

/**
 * Reset internal session tracking. Useful for tests.
 */
export const resetSessionState = () => {
  sessionDeathCount = 0;
};
