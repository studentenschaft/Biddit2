import {
  InteractionRequiredAuthError,
  BrowserAuthError,
} from "@azure/msal-browser";
import { msalInstance, initializeMsalInstance, apiScopes } from "./authConfig";

// Session state tracking
let sessionDeathCount = 0;
const MAX_SESSION_FAILURES = 3;

// Event emitter for session/offline state changes
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
 * Global function to get fresh token for axios interceptor
 * Uses the shared MSAL instance from authConfig
 * @returns {Promise<string|null>} New access token or null if refresh failed
 */
export const getRefreshToken = async () => {
  try {
    await initializeMsalInstance();
    const accounts = msalInstance.getAllAccounts();

    if (accounts.length === 0) {
      console.error("No accounts found - session expired");
      emitSessionEvent("SESSION_EXPIRED");
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
      // Handle InteractionRequiredAuthError - session expired, need full re-login
      if (silentError instanceof InteractionRequiredAuthError) {
        console.log("Interaction required - session expired");
        emitSessionEvent("SESSION_EXPIRED");
        return null;
      }

      // Handle BrowserAuthError (includes monitor_window_timeout, popup_window_error, etc.)
      // For these, try popup recovery since the session might still be valid
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

    if (sessionDeathCount >= MAX_SESSION_FAILURES) {
      emitSessionEvent("SESSION_EXPIRED");
    }

    return null;
  }
};

/**
 * Attempt popup recovery for BrowserAuthError (monitor_window_timeout, etc.)
 * This is used when silent acquisition fails due to iframe issues but session may still be valid
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
    sessionDeathCount++;

    if (sessionDeathCount >= MAX_SESSION_FAILURES) {
      emitSessionEvent("SESSION_EXPIRED");
    }

    return null;
  }
};

/**
 * Handle authentication failure (e.g., redirect to login)
 * @param {Error} error - The authentication error
 */
export const handleAuthFailure = (error) => {
  console.error("Authentication failed:", error);
  emitSessionEvent("SESSION_EXPIRED");
};

/**
 * Clear session and redirect to login
 * Called when session is definitively dead
 */
export const clearSessionAndRedirect = () => {
  // Clear MSAL cache properly
  const accounts = msalInstance.getAllAccounts();
  accounts.forEach((account) => {
    msalInstance.setActiveAccount(null);
  });

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
