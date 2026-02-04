/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { LogLevel, PublicClientApplication } from "@azure/msal-browser";

/**
 * Configuration object to be passed to MSAL instance on creation.
 * For a full list of MSAL.js configuration parameters, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/configuration.md
 */
export const msalConfig = {
  auth: {
    clientId: "67a86d1c-e99b-4b9b-968f-5ac10a21bc5e", // This is the ONLY mandatory field that you need to supply.
    authority:
      "https://login.microsoftonline.com/a7262e59-1b56-4f5a-a412-6f07181f48ee", // Defaults to "https://login.microsoftonline.com/common"
    redirectUri:
      window.location.hostname === "localhost"
        ? "http://localhost:3000/"
        : window.location.hostname === "dev-biddit.netlify.app"
        ? "https://dev-biddit.netlify.app/"
        : "https://biddit.app/",
  },
  cache: {
    cacheLocation: "localStorage", // Configures cache location. "sessionStorage" is more secure, but "localStorage" gives you SSO between tabs.
    storeAuthStateInCookie: true, // Set this to "true" if you are having issues on IE11 or Edge
  },
  system: {
    // Increased timeouts to prevent monitor_window_timeout errors
    iframeHashTimeout: 10000, // Increased from default 6000ms
    windowHashTimeout: 60000, // Default 60000ms
    loadFrameTimeout: 10000, // Increased from default 6000ms
    navigateFrameWait: 500, // Wait time for iframe navigation
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Info:
            console.info(message);
            return;
          case LogLevel.Verbose:
            console.debug(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
          default:
            return;
        }
      },
    },
  },
};

/**
 * Single MSAL instance shared across the application.
 * This prevents race conditions and inconsistent state from multiple instances.
 */
export const msalInstance = new PublicClientApplication(msalConfig);

/**
 * Initialize the MSAL instance. Call this once at app startup.
 */
let msalInitialized = false;
export const initializeMsalInstance = async () => {
  if (!msalInitialized) {
    await msalInstance.initialize();
    msalInitialized = true;
  }
  return msalInstance;
};

/**
 * API scopes required for accessing university integration APIs
 */
export const apiScopes = ["https://integration.unisg.ch/api/user_impersonation"];

/**
 * Scopes you add here will be prompted for user consent during sign-in.
 * By default, MSAL.js will add OIDC scopes (openid, profile, email) to any login request.
 * For more information about OIDC scopes, visit:
 * https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
 */
export const loginRequest = {
  scopes: ["User.Read"],
};
