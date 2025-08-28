import axios from "axios";
import { PublicClientApplication, InteractionRequiredAuthError } from "@azure/msal-browser";
import { msalConfig } from "../auth/authConfig";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

// Create MSAL instance for token operations
let msalInstance = null;

/**
 * Initialize the MSAL instance for the axios client
 * This should be called after the main AuthProvider has initialized MSAL
 */
const initializeMsalInstance = async () => {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
    await msalInstance.initialize();
  }
  return msalInstance;
};

/**
 * Attempt to refresh the authentication token silently
 * @returns {Promise<string|null>} The new access token or null if refresh failed
 */
const refreshToken = async () => {
  try {
    await initializeMsalInstance();
    const account = msalInstance.getAllAccounts()[0];
    
    if (!account) {
      console.warn("No account found for token refresh");
      return null;
    }

    const response = await msalInstance.acquireTokenSilent({
      account,
      scopes: ["https://integration.unisg.ch/api/user_impersonation"],
    });

    console.log("✅ Token refreshed successfully");
    return response.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      console.warn("Token refresh requires user interaction, redirecting to login");
      // Redirect to login page when silent refresh fails
      try {
        await msalInstance.acquireTokenRedirect({
          scopes: ["https://integration.unisg.ch/api/user_impersonation"],
        });
      } catch (redirectError) {
        console.error("Token refresh redirect failed:", redirectError);
      }
      return null;
    } else {
      console.error("Token refresh failed:", error);
      return null;
    }
  }
};

// Create axios instance with default configuration
const axiosClient = axios.create({
  timeout: 30000, // 30 second timeout
  headers: {
    "Content-Type": "application/json",
    "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
    "X-RequestedLanguage": "EN",
    "API-Version": "1",
  },
});

// Request interceptor - adds auth token to requests
axiosClient.interceptors.request.use(
  (config) => {
    // If the request already has an Authorization header, keep it
    // This maintains compatibility with existing code that manually sets the token
    if (!config.headers.Authorization) {
      // We could try to get the token here, but it's better to let the existing
      // code continue to pass tokens explicitly to maintain current patterns
      console.debug("No auth token in request headers - this may be intentional");
    }
    return config;
  },
  (error) => {
    console.error("Request interceptor error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor - handles 401 errors
axiosClient.interceptors.response.use(
  (response) => {
    // Return successful responses as-is
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Check if this is a 401 error and we haven't already tried to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.warn("🔄 Received 401 error, attempting token refresh...");
      originalRequest._retry = true;

      try {
        const newToken = await refreshToken();
        
        if (newToken) {
          // Update the original request with the new token
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          console.log("🔄 Retrying request with refreshed token...");
          
          // Retry the original request
          return axiosClient(originalRequest);
        } else {
          // Token refresh failed, let the error propagate
          console.error("❌ Token refresh failed, cannot retry request");
          // The refreshToken function already handles redirect to login
        }
      } catch (refreshError) {
        console.error("❌ Error during token refresh:", refreshError);
        // Continue to normal error handling
      }
    }

    // For all other errors, or if token refresh failed, use existing error handling
    errorHandlingService.handleError(error);
    return Promise.reject(error);
  }
);

export default axiosClient;