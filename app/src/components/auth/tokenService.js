import {
  PublicClientApplication,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";
import { msalConfig } from "./authConfig";

const msalInstance = new PublicClientApplication(msalConfig);

/**
 * Global function to get fresh token for axios interceptor
 * @returns {Promise<string|null>} New access token or null if refresh failed
 */
export const getRefreshToken = async () => {
  try {
    await msalInstance.initialize();
    const accounts = msalInstance.getAllAccounts();

    if (accounts.length === 0) {
      throw new Error("No accounts found");
    }

    const account = accounts[0];

    try {
      const response = await msalInstance.acquireTokenSilent({
        account,
        scopes: ["https://integration.unisg.ch/api/user_impersonation"],
      });
      return response.accessToken;
    } catch (silentError) {
      if (silentError instanceof InteractionRequiredAuthError) {
        const response = await msalInstance.acquireTokenRedirect({
          scopes: ["https://integration.unisg.ch/api/user_impersonation"],
        });
        return response.accessToken;
      }
      throw silentError;
    }
  } catch (error) {
    console.error("Failed to refresh token:", error);
    return null;
  }
};

/**
 * Handle authentication failure (e.g., redirect to login)
 * @param {Error} error - The authentication error
 */
export const handleAuthFailure = (error) => {
  console.error("Authentication failed, redirecting to login:", error);

  // Clear any stored tokens/state
  localStorage.removeItem("msal.cache");

  // Redirect to login
  window.location.href = window.location.origin;
};
