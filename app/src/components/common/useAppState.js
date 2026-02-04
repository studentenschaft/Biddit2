import { useContext } from "react";
import { AppStateContext } from "./AppStateProvider";

/**
 * Hook to access global app state (offline status, session expiry)
 */
export const useAppState = () => useContext(AppStateContext);
