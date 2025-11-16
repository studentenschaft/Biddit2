import {
  PublicClientApplication,
  EventType,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";
import { msalConfig } from "./authConfig";
import { MsalProvider } from "@azure/msal-react";
import PropTypes from "prop-types";
import { useRecoilState } from "recoil";
import { authTokenState } from "../recoil/authAtom";
import { useCallback, useEffect } from "react";

// custom error handler
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

const msalInstance = new PublicClientApplication(msalConfig);

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
          scopes: ["https://integration.unisg.ch/api/user_impersonation"],
        });
        setAuthToken(response.accessToken);
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          try {
            const response = await msalInstance.acquireTokenRedirect({
              scopes: ["https://integration.unisg.ch/api/user_impersonation"],
            });
            setAuthToken(response.accessToken);
          } catch (err) {
            console.error("Token acquisition via redirect failed:", err);
          }
        } else {
          console.error("Silent token acquisition failed:", error);
          errorHandlingService.handleError(error);
        }
      }
    },
    [setAuthToken]
  );

  // Initialize MSAL instance once
  useEffect(() => {
    const initializeMsal = async () => {
      await msalInstance.initialize();
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
