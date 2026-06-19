import { createContext } from "react";

/**
 * Context for managing global app state modals (offline, session expired,
 * session renew).
 */
export const AppStateContext = createContext({
  isOffline: false,
  isSessionExpired: false,
  isSessionRenew: false,
  setOffline: () => {},
  setSessionExpired: () => {},
  setSessionRenew: () => {},
});
