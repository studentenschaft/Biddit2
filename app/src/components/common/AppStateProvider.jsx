import { createContext, useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { addNetworkEventListener } from "../helpers/axiosClient";
import { addSessionEventListener } from "../auth/tokenService";
import OfflineModal from "./OfflineModal";
import SessionExpiredModal from "./SessionExpiredModal";

/**
 * Context for managing global app state modals (offline, session expired)
 * Export for use with useAppState hook
 */
export const AppStateContext = createContext({
  isOffline: false,
  isSessionExpired: false,
  setOffline: () => {},
  setSessionExpired: () => {},
});

/**
 * Provider component that manages global app state and renders blocking modals
 * Listens to network events from axiosClient and session events from tokenService
 */
export const AppStateProvider = ({ children }) => {
  const [isOffline, setIsOffline] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

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
      if (event.type === "SESSION_EXPIRED") {
        setIsSessionExpired(true);
      }
    });

    return () => {
      unsubscribeNetwork();
      unsubscribeSession();
    };
  }, []);

  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  const contextValue = {
    isOffline,
    isSessionExpired,
    setOffline: setIsOffline,
    setSessionExpired: setIsSessionExpired,
  };

  return (
    <AppStateContext.Provider value={contextValue}>
      {children}
      
      {/* Blocking modals - rendered at app root level */}
      <OfflineModal isVisible={isOffline && !isSessionExpired} onRefresh={handleRefresh} />
      <SessionExpiredModal isVisible={isSessionExpired} />
    </AppStateContext.Provider>
  );
};

AppStateProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AppStateProvider;
