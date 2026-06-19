import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { addNetworkEventListener } from "../helpers/axiosClient";
import { addSessionEventListener, SessionEvent } from "../auth/tokenService";
import { AppStateContext } from "./AppStateContext";
import OfflineModal from "./OfflineModal";
import SessionExpiredModal from "./SessionExpiredModal";
import SessionRenewModal from "./SessionRenewModal";

/**
 * Provider component that manages global app state and renders blocking modals.
 * Listens to network events from axiosClient and session events from
 * tokenService, and shows at most one modal with the precedence:
 * expired > renew > offline.
 */
export const AppStateProvider = ({ children }) => {
  const [isOffline, setIsOffline] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [isSessionRenew, setIsSessionRenew] = useState(false);

  // Handle coming back online
  const handleOnline = useCallback(() => {
    setIsOffline(false);
  }, []);

  // Handle going offline
  const handleOffline = useCallback(() => {
    setIsOffline(true);
  }, []);

  useEffect(() => {
    // Listen to browser online/offline events
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Set initial state
    if (!navigator.onLine) {
      setIsOffline(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  useEffect(() => {
    // Listen to network events from axiosClient
    const unsubscribeNetwork = addNetworkEventListener((event) => {
      if (event.type === "OFFLINE") {
        setIsOffline(true);
      } else if (event.type === "ONLINE") {
        setIsOffline(false);
      }
    });

    // Listen to session events from tokenService
    const unsubscribeSession = addSessionEventListener((event) => {
      if (event.type === SessionEvent.EXPIRED) {
        // A definitive expiry supersedes a pending renew prompt.
        setIsSessionRenew(false);
        setIsSessionExpired(true);
      } else if (event.type === SessionEvent.RENEW) {
        setIsSessionRenew(true);
      }
    });

    return () => {
      if (typeof unsubscribeNetwork === "function") unsubscribeNetwork();
      if (typeof unsubscribeSession === "function") unsubscribeSession();
    };
  }, []);

  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  const contextValue = {
    isOffline,
    isSessionExpired,
    isSessionRenew,
    setOffline: setIsOffline,
    setSessionExpired: setIsSessionExpired,
    setSessionRenew: setIsSessionRenew,
  };

  // Single-modal precedence: expired > renew > offline.
  const showExpired = isSessionExpired;
  const showRenew = !isSessionExpired && isSessionRenew;
  const showOffline = !isSessionExpired && !isSessionRenew && isOffline;

  return (
    <AppStateContext.Provider value={contextValue}>
      {children}

      {/* Blocking modals - rendered at app root level */}
      <OfflineModal isVisible={showOffline} onRefresh={handleRefresh} />
      <SessionRenewModal isVisible={showRenew} />
      <SessionExpiredModal isVisible={showExpired} />
    </AppStateContext.Provider>
  );
};

AppStateProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AppStateProvider;
