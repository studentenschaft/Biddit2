import { useState, useEffect } from "react";
import {
  getDegradedMode,
  addDegradedModeListener,
} from "../helpers/degradedModeService";

/**
 * Subscribes to the degraded-mode kill switch (see
 * `helpers/degradedModeService.js`). Re-renders whenever the flag changes.
 * @returns {{ isDegradedMode: boolean, message: string|null }}
 */
export const useDegradedMode = () => {
  const [state, setState] = useState(getDegradedMode());

  useEffect(() => {
    const unsubscribe = addDegradedModeListener(setState);
    // The service state may have changed between the initial useState read
    // (render time) and this effect's subscription taking effect - re-sync
    // immediately to close that missed-update window.
    setState(getDegradedMode());
    return unsubscribe;
  }, []);

  return state;
};

export default useDegradedMode;
