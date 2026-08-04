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
    return unsubscribe;
  }, []);

  return state;
};

export default useDegradedMode;
