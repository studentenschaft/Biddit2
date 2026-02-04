import {
  EventType,
  InteractionRequiredAuthError,
  BrowserAuthError,
} from "@azure/msal-browser";
import { msalInstance, initializeMsalInstance, apiScopes } from "./authConfig";
import { MsalProvider } from "@azure/msal-react";
import PropTypes from "prop-types";
import { useRecoilState } from "recoil";
import { authTokenState } from "../recoil/authAtom";
import { useCallback, useEffect } from "react";

// custom error handler
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

// Use shared MSAL instance from authConfig (no longer creating a new one here)

export const AuthProvider = ({ children }) => {
  const [, setAuthToken] = useRecoilState(authTokenState);

  const acquireToken = useCallback(
    async (account) => {
      if (!account) {
        return;
      }

      try {
        const response = await msalInstance.acquireTokenSilent({
          account,
          scopes: apiScopes,
        });
        setAuthToken(response.accessToken);
      } catch (error) {
        // Handle InteractionRequiredAuthError - use redirect (full page) for proper login flow
        if (error instanceof InteractionRequiredAuthError) {
          console.log("Interaction required, redirecting to login...");
          await msalInstance.acquireTokenRedirect({
            scopes: apiScopes,
          });
          // Note: redirect will navigate away, so no token return here
        } 
        // Handle BrowserAuthError (includes monitor_window_timeout)
        // This is for recovery when silent fails due to iframe issues - try popup first
        else if (error instanceof BrowserAuthError) {
          console.warn("Browser auth error, trying popup recovery:", error.errorCode);
          try {
            const response = await msalInstance.acquireTokenPopup({
              scopes: apiScopes,
            });
            setAuthToken(response.accessToken);
          } catch (popupError) {
            console.warn("Popup failed, falling back to redirect:", popupError);
            await msalInstance.acquireTokenRedirect({
              scopes: apiScopes,
            });
          }
        } else {
          console.error("Silent token acquisition failed:", error);
          errorHandlingService.handleError(error);
        }
      }
    },
    [setAuthToken]
  );

  // Initialize MSAL instance once using shared initializer
  useEffect(() => {
    const initializeMsal = async () => {
      await initializeMsalInstance();
      const account = msalInstance.getAllAccounts()[0];
      if (account) {
        msalInstance.setActiveAccount(account);
        acquireToken(account);
      }
    };

    initializeMsal();
  }, [acquireToken]);

  // Listen for sign-in event and set active account
  useEffect(() => {
    const callbackId = msalInstance.addEventCallback((event) => {
      if (
        event.eventType === EventType.LOGIN_SUCCESS &&
        event.payload.account
      ) {
        const account = event.payload.account;
        msalInstance.setActiveAccount(account);
        acquireToken(account);
      }
    });

    return () => {
      msalInstance.removeEventCallback(callbackId);
    };
  }, [acquireToken]);

  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
