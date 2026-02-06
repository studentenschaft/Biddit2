import { createContext } from "react";

/**
 * Context for managing global app state modals (offline, session expired)
 */
export const AppStateContext = createContext({
  isOffline: false,
  isSessionExpired: false,
  setOffline: () => {},
  setSessionExpired: () => {},
});
